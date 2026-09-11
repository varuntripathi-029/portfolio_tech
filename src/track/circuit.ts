/**
 * The circuit centreline.
 *
 * The shape is authored as a HAND-PLACED POLYGON, rounded at each vertex into
 * an arc, with the straights in between. Control points are then sampled
 * along that path and a closed centripetal Catmull-Rom spline is fitted
 * through them, which is what everything downstream actually reads.
 *
 * ## Why hand-placed vertices, not vertices on a circle
 *
 * An earlier version put the vertices on a circle so the polygon would close
 * by construction and stay convex, which guaranteed it could not cross
 * itself. That produced a shape that PASSED every check but read as a rounded
 * pentagon on the minimap: five corners of near-identical radius, no
 * character, no sense of a track designer having been in the room.
 *
 * Convexity was a shortcut around the real guard, which is the separation
 * assertion (non-adjacent centreline points stay >= 60m apart, which also
 * catches a self-intersection as a separation of zero). A hand-placed polygon
 * can be non-convex, including a genuine CONCAVE vertex where the boundary
 * bends back toward the infield, as long as it stays simple. Closure is still
 * automatic: connecting N points in a cycle always produces a closed loop, no
 * solver required, whether or not it is convex.
 *
 * The five vertices below (in `VERTICES`) were placed by hand, then scaled up
 * once verifying the shape was simple (no edge crossings) and that the
 * intended vertex was genuinely reflex (its turn sign opposite the loop's
 * dominant winding), using an offline prototype. Radii were then chosen per
 * vertex for character: four visibly different open radii plus the one lift
 * corner, rather than one radius repeated five times.
 */

/** Lateral grip, in g. Sets the flat-out radius: v^2 / (grip * 9.81). */
export const GRIP_G = 4.5
export const G = 9.81
/** Top speed the flat-out radius is measured against. */
export const REF_SPEED = 85

/** Radius at or above which REF_SPEED needs no lift. About 164m. */
export const FLAT_RADIUS = (REF_SPEED * REF_SPEED) / (GRIP_G * G)

const DEG = Math.PI / 180

interface Vertex {
  /** Names the corner rounded at this vertex. */
  id: string
  x: number
  z: number
  radius: number
  /** True for the one corner deliberately below the flat-out radius. */
  lift?: boolean
}

/**
 * The polygon, in lap order. Side i runs from VERTICES[i] to
 * VERTICES[(i+1) % N]; SIDE_IDS[i] names it.
 *
 * Side 4 (turnSweep -> turn1) is `mainStraight`, the one side the start/finish
 * line sits on. It is split into `mainOut` (line to turn1) and `mainIn`
 * (turnSweep to the line) below.
 *
 * Coordinates are local; only their relative geometry matters, since
 * `trackFrame.ts` does not care about absolute position or heading.
 */
const VERTICES: Vertex[] = [
  { id: 'turn1', x: 0, z: 627, radius: 220 },
  // The concave vertex. Pulled in from the rough outline it was sketched from
  // until its turn sign flipped against the loop's dominant winding, which is
  // what makes it a genuine reflex point rather than just a flatter convex
  // corner: the boundary bends back toward the infield here.
  { id: 'notch', x: 172, z: 38, radius: 190 },
  { id: 'turn2', x: 533, z: -507, radius: 200 },
  // The lift corner. Sits at the end of achievementsStraight (see SIDE_IDS),
  // the longest straight on the lap, so it reads as a braking zone rather
  // than just another bend.
  { id: 'tightCorner', x: -533, z: -507, radius: 112, lift: true },
  { id: 'turnSweep', x: -861, z: 195, radius: 300 },
]

const SIDE_IDS = [
  'projectsStraight',
  'notchStraight',
  'achievementsStraight',
  'experienceStraight',
  'mainStraight',
] as const

const N = VERTICES.length
const MAIN_SIDE_INDEX = 4

if (SIDE_IDS.length !== N) {
  throw new Error('circuit: VERTICES and SIDE_IDS must be the same length')
}

/**
 * How much of `mainStraight` sits after the line (departing, mainOut) versus
 * before it (arriving, mainIn).
 *
 * Unlike the old cyclic layout, this split has no geometric consequence: the
 * straight is one continuous run of zero curvature from turnSweep's exit to
 * turn1's entry regardless of where s=0 falls inside it, and the stop-on-
 * straight assertion walks straight through the s=0 wrap point to measure it.
 * The split is bookkeeping only, roughly even so neither the grid nor CONTACT
 * sits on a cramped stub.
 */
const MAIN_IN_LENGTH = 172

function sub(a: { x: number; z: number }, b: { x: number; z: number }) {
  return { x: a.x - b.x, z: a.z - b.z }
}
function norm(v: { x: number; z: number }) {
  const m = Math.hypot(v.x, v.z) || 1
  return { x: v.x / m, z: v.z / m }
}

/** Signed turn in degrees from direction `a` to direction `b`. */
function signedTurn(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const cross = a.x * b.z - a.z * b.x
  const dot = a.x * b.x + a.z * b.z
  return Math.atan2(cross, dot) / DEG
}

const edgeVecs = VERTICES.map((v, i) => sub(VERTICES[(i + 1) % N], v))
const edgeDirs = edgeVecs.map(norm)
const edgeLens = edgeVecs.map((v) => Math.hypot(v.x, v.z))

/** Signed exterior turn AT each vertex, between the edge arriving and the edge leaving. */
const turns = VERTICES.map((_, i) => signedTurn(edgeDirs[(i - 1 + N) % N], edgeDirs[i]))

{
  const net = turns.reduce((a, b) => a + b, 0)
  // Guaranteed by the exterior-angle sum theorem for ANY simple polygon,
  // convex or not, so a failure here means VERTICES traces a shape whose net
  // turn is not a full +/-360 revolution, which for a hand-placed polygon
  // means it self-intersects.
  if (Math.abs(Math.abs(net) - 360) > 1e-6) {
    throw new Error(
      `circuit: VERTICES turn by a net ${net.toFixed(2)} degrees, not +/-360. The polygon is not ` +
        'simple (it likely self-intersects); check the vertex order.',
    )
  }
}

/** How much each vertex's rounding eats off its two adjacent sides. */
const tangents = VERTICES.map((v, i) => v.radius * Math.tan((Math.abs(turns[i]) / 2) * DEG))

const MIN_SECTION_STRAIGHT = 150

/** Straight length that survives each side once both its vertices are rounded. */
const sideLengths: Record<string, number> = (() => {
  const out: Record<string, number> = {}
  SIDE_IDS.forEach((id, i) => {
    const length = edgeLens[i] - tangents[i] - tangents[(i + 1) % N]
    const floor = i === MAIN_SIDE_INDEX ? MAIN_IN_LENGTH + 100 : MIN_SECTION_STRAIGHT
    if (length < floor) {
      throw new Error(
        `circuit: side "${id}" leaves only ${length.toFixed(1)}m of straight after rounding its ` +
          'corners. Move its vertices apart, or reduce a radius.',
      )
    }
    out[id] = length
  })
  return out
})()

export const MAIN_STRAIGHT_LENGTH = sideLengths.mainStraight
const mainOutLength = MAIN_STRAIGHT_LENGTH - MAIN_IN_LENGTH

export type SegmentKind = 'straight' | 'arc'

export interface ResolvedSegment {
  id: string
  kind: SegmentKind
  /** Arc length at which this segment starts. */
  start: number
  length: number
  /** Radius for arcs, Infinity for straights. */
  radius: number
  /** Signed turn in degrees for arcs, 0 for straights. */
  turn: number
  lift: boolean
}

/**
 * One lap, in order from the start/finish line.
 *
 * Walking the polygon from s=0 (mid-mainStraight): mainOut, then for each
 * vertex in turn its arc followed by the side after it, except the last
 * vertex (turnSweep), whose following side IS mainStraight and is instead
 * closed out as mainIn.
 */
export const RESOLVED: ResolvedSegment[] = (() => {
  const out: ResolvedSegment[] = []
  let s = 0
  const straight = (id: string, length: number) => {
    out.push({ id, kind: 'straight', start: s, length, radius: Infinity, turn: 0, lift: false })
    s += length
  }
  const arc = (v: Vertex, turn: number) => {
    const length = v.radius * Math.abs(turn) * DEG
    out.push({
      id: v.id,
      kind: 'arc',
      start: s,
      length,
      radius: v.radius,
      turn,
      lift: Boolean(v.lift),
    })
    s += length
  }

  straight('mainOut', mainOutLength)
  for (let i = 0; i < N; i++) {
    arc(VERTICES[i], turns[i])
    if (i < N - 1) straight(SIDE_IDS[i], sideLengths[SIDE_IDS[i]])
  }
  straight('mainIn', MAIN_IN_LENGTH)
  return out
})()

export const DESIGN_LENGTH = RESOLVED.reduce((a, r) => a + r.length, 0)

export function segmentById(id: string): ResolvedSegment {
  const found = RESOLVED.find((r) => r.id === id)
  if (!found) throw new Error(`circuit: no segment with id "${id}"`)
  return found
}

/**
 * Walks the resolved path, emitting sampled points, and returns the endpoint.
 *
 * The arc centre is offset from the current heading by +90 degrees for a left
 * turn and -90 for a right turn (`h + sign(turn) * 90`), which is what lets
 * this handle both signs correctly. The old convex-only version fixed the
 * offset at +90 always, which only worked because every turn there was
 * positive.
 */
function walk(spacing: number, emit: (x: number, z: number) => void): { x: number; z: number } {
  let x = 0
  let z = 0
  let h = 90 * DEG

  for (const seg of RESOLVED) {
    const steps = Math.max(1, Math.round(seg.length / spacing))
    if (seg.kind === 'straight') {
      const dx = Math.cos(h)
      const dz = Math.sin(h)
      for (let i = 0; i < steps; i++) {
        const t = (seg.length * i) / steps
        emit(x + dx * t, z + dz * t)
      }
      x += dx * seg.length
      z += dz * seg.length
    } else {
      const t = seg.turn * DEG
      const sign = Math.sign(t) || 1
      const cx = x + Math.cos(h + sign * (Math.PI / 2)) * seg.radius
      const cz = z + Math.sin(h + sign * (Math.PI / 2)) * seg.radius
      const a0 = Math.atan2(z - cz, x - cx)
      for (let i = 0; i < steps; i++) {
        const a = a0 + (t * i) / steps
        emit(cx + Math.cos(a) * seg.radius, cz + Math.sin(a) * seg.radius)
      }
      const a1 = a0 + t
      x = cx + Math.cos(a1) * seg.radius
      z = cz + Math.sin(a1) * seg.radius
      h += t
    }
  }
  return { x, z }
}

/**
 * Closure is a consequence of VERTICES forming a closed polygon, not
 * something solved for, so this only has to confirm it. A failure means the
 * turn/tangent bookkeeping above has a bug, not that the layout is wrong.
 */
{
  const end = walk(1e9, () => {})
  const gap = Math.hypot(end.x, end.z)
  if (gap > 1e-6) {
    throw new Error(
      `circuit: the path misses its own start by ${gap.toFixed(4)}m despite VERTICES forming a ` +
        'closed polygon. This means the RESOLVED construction has a bug, not the layout.',
    )
  }
}

/**
 * Control points for the spline, sampled along the resolved path.
 *
 * Spacing is a compromise: too coarse and the spline cuts a corner apex, too
 * fine and a closed Catmull-Rom starts to wobble between near-collinear points
 * on a straight. 12m tracks a 112m radius to within a few centimetres.
 */
const CP_SPACING = 12

export function buildControlPoints(): { x: number; z: number }[] {
  const points: { x: number; z: number }[] = []
  walk(CP_SPACING, (x, z) => points.push({ x, z }))
  return points
}

/**
 * Where each section stop sits, as an offset into a named straight.
 *
 * `into` is measured from the start of that straight and must clear the 5g
 * braking distance from 85 m/s (about 74m), so the whole braking zone is on
 * the straight too, while leaving room behind it to launch.
 */
export interface StopSpec {
  id: string
  label: string
  segment: string
  into: number
}

export const STOP_SPECS: StopSpec[] = [
  { id: 'projects', label: 'Projects', segment: 'projectsStraight', into: 130 },
  { id: 'achievements', label: 'Achievements', segment: 'achievementsStraight', into: 250 },
  { id: 'experience', label: 'Experience', segment: 'experienceStraight', into: 150 },
]

/** Metres before the start/finish line where the car runs dry. */
export const CONTACT_BEFORE_LINE = 40
