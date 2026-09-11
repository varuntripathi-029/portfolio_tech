/**
 * Dev-time geometry checks.
 *
 * A self-intersecting or near-touching loop is the single most likely way a
 * hand-authored layout goes wrong, and it is invisible from a chase cam until
 * someone drives to that part of the track. So these throw rather than warn,
 * and they run in the sim script, the plot script and (dev only) at boot.
 *
 * Pure: no three, no React. Reads only the arc-length table.
 */

import { FLAT_RADIUS, RESOLVED } from './circuit'
import { TRACK_LENGTH, deltaS, frameAt, pointInLoop } from './trackFrame'
import { BANDS, BARRIER_X } from '../scene/trackLayout'
import { BRAKING_STOPS, SECTIONS } from '../data/sections'

/** Minimum centreline separation between non-adjacent parts of the track. */
export const MIN_SEPARATION = 60
/**
 * Two points count as non-adjacent once they are this far apart along the
 * track. Below it they are simply the same corner and are meant to be close.
 */
const ADJACENCY_WINDOW = 150
/** Minimum clearance from any prop to any part of the centreline. */
export const MIN_PROP_CLEARANCE = 20

/** Curvature below this counts as straight for the purposes of a stop. */
const STRAIGHT_CURVATURE = 1 / 2000

function fail(message: string): never {
  throw new Error(`circuit geometry: ${message}`)
}

/**
 * Non-adjacent parts of the track stay MIN_SEPARATION apart, and the loop
 * never crosses itself. Both are the same sweep: a self-intersection is a
 * separation of zero.
 */
export interface SeparationResult {
  /** Closest approach between two non-adjacent parts of the centreline. */
  distance: number
  at: [number, number]
}

/**
 * Measures the closest approach between non-adjacent parts of the track. A
 * self-intersection is just a separation of zero, so one sweep answers both
 * questions.
 */
export function measureSeparation(step = 2): SeparationResult {
  const pts: { x: number; z: number; s: number }[] = []
  for (let s = 0; s < TRACK_LENGTH; s += step) {
    const fr = frameAt(s)
    pts.push({ x: fr.x, z: fr.z, s })
  }

  let distance = Infinity
  let at: [number, number] = [0, 0]
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (Math.abs(deltaS(pts[i].s, pts[j].s)) < ADJACENCY_WINDOW) continue
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z)
      if (d < distance) {
        distance = d
        at = [pts[i].s, pts[j].s]
      }
    }
  }
  return { distance, at }
}

export function assertSeparation(step = 2): number {
  const { distance, at } = measureSeparation(step)
  if (distance < MIN_SEPARATION) {
    fail(
      `non-adjacent track sections are ${distance.toFixed(1)}m apart at s=${at[0].toFixed(0)} ` +
        `and s=${at[1].toFixed(0)}, minimum is ${MIN_SEPARATION}m. ` +
        (distance < BARRIER_X * 2 ? 'They overlap: the loop crosses itself. ' : '') +
        'Widen the layout in src/track/circuit.ts.',
    )
  }
  return distance
}

/** Corners are either flat out at 85 m/s or deliberately marked as a lift. */
export interface RadiusReport {
  id: string
  designRadius: number
  measuredRadius: number
  lift: boolean
}

/** Measures every corner without judging it. */
export function measureCorners(): RadiusReport[] {
  const report: RadiusReport[] = []
  for (const seg of RESOLVED) {
    if (seg.kind !== 'arc') continue
    // Measure over the middle of the arc, away from the tangent blend at
    // either end where curvature is still ramping in.
    const from = seg.start + seg.length * 0.25
    const to = seg.start + seg.length * 0.75
    let peak = 0
    for (let s = from; s <= to; s += 1) {
      const k = Math.abs(frameAt(s).curvature)
      if (k > peak) peak = k
    }
    report.push({
      id: seg.id,
      designRadius: seg.radius,
      measuredRadius: peak > 1e-9 ? 1 / peak : Infinity,
      lift: seg.lift,
    })
  }
  return report
}

export function assertCornerRadii() {
  const report = measureCorners()

  for (const r of report) {
    if (!r.lift && r.measuredRadius < FLAT_RADIUS) {
      fail(
        `corner "${r.id}" measures ${r.measuredRadius.toFixed(0)}m radius, below the ` +
          `${FLAT_RADIUS.toFixed(0)}m flat-out radius, but is not marked lift:true. ` +
          'Either open it up or mark it.',
      )
    }
    if (r.lift && (r.measuredRadius < 90 || r.measuredRadius > 120)) {
      fail(
        `lift corner "${r.id}" measures ${r.measuredRadius.toFixed(0)}m radius, outside the ` +
          '90 to 120m band the spec allows for a corner that needs a lift.',
      )
    }
  }

  const lifts = report.filter((r) => r.lift)
  if (lifts.length < 1 || lifts.length > 2) {
    fail(`the circuit has ${lifts.length} lift corners, the spec allows one or two`)
  }
  return report
}

/**
 * Every section stop sits on a straight, at least 80m into it, with the whole
 * 5g braking zone from 85 m/s on that straight too.
 */
export function assertStopsOnStraights() {
  const BRAKE_DISTANCE = (85 * 85) / (2 * 5 * 9.81) // about 74m
  for (const stop of SECTIONS) {
    // The grid slot is reached by rolling over the line, not by braking.
    if (stop.kind === 'grid') continue

    const k = Math.abs(frameAt(stop.s).curvature)
    if (k > STRAIGHT_CURVATURE) {
      fail(
        `stop "${stop.id}" at s=${stop.s.toFixed(0)} sits on curvature ${k.toExponential(2)} ` +
          `(radius ${(1 / k).toFixed(0)}m). Stops must be on a straight, never mid-corner.`,
      )
    }

    // Walk back to find where this straight began and forward to its end.
    let back = 0
    while (back < 400 && Math.abs(frameAt(stop.s - back - 1).curvature) <= STRAIGHT_CURVATURE) back++
    let fwd = 0
    while (fwd < 400 && Math.abs(frameAt(stop.s + fwd + 1).curvature) <= STRAIGHT_CURVATURE) fwd++

    const straightLength = back + fwd
    if (straightLength < 150) {
      fail(
        `stop "${stop.id}" is on a straight only ${straightLength.toFixed(0)}m long, minimum is 150m`,
      )
    }
    if (back < 80) {
      fail(
        `stop "${stop.id}" is only ${back.toFixed(0)}m into its straight, minimum is 80m ` +
          `(5g braking from 85 m/s needs ${BRAKE_DISTANCE.toFixed(0)}m and must not start mid-corner)`,
      )
    }
  }
}

/** The four braking stops are spread roughly evenly around the lap. */
export function assertStopSpread() {
  const gaps: number[] = []
  for (let i = 0; i < BRAKING_STOPS.length; i++) {
    const a = BRAKING_STOPS[i].s
    const b = BRAKING_STOPS[(i + 1) % BRAKING_STOPS.length].s
    gaps.push(i === BRAKING_STOPS.length - 1 ? TRACK_LENGTH - a + b : b - a)
  }
  const mean = TRACK_LENGTH / BRAKING_STOPS.length
  for (let i = 0; i < gaps.length; i++) {
    const ratio = gaps[i] / mean
    if (ratio < 0.5 || ratio > 1.7) {
      fail(
        `the gap after stop "${BRAKING_STOPS[i].id}" is ${gaps[i].toFixed(0)}m, ` +
          `${ratio.toFixed(2)}x the ${mean.toFixed(0)}m average. Stops must be roughly evenly spread ` +
          '(0.5x to 1.7x).',
      )
    }
  }
  return gaps
}

export interface PlacedProp {
  x: number
  z: number
  /** Arc length it was placed at, so its own stretch of track is excluded. */
  s: number
  what: string
}

/**
 * Nothing lands on another part of the track. A prop is allowed to be close
 * to the centreline it was placed against, since that is the point of it, but
 * not to any other part of the loop.
 */
export function measurePropClearance(
  props: PlacedProp[],
  step = 4,
): { distance: number; what: string } {
  const line: { x: number; z: number; s: number }[] = []
  for (let s = 0; s < TRACK_LENGTH; s += step) {
    const fr = frameAt(s)
    line.push({ x: fr.x, z: fr.z, s })
  }

  let distance = Infinity
  let what = ''
  for (const prop of props) {
    for (const p of line) {
      // Skip the stretch this prop belongs to. A trackside prop sits just
      // outside the barrier, so its own length of track is legitimately near.
      if (Math.abs(deltaS(prop.s, p.s)) < ADJACENCY_WINDOW) continue
      const d = Math.hypot(prop.x - p.x, prop.z - p.z)
      if (d < distance) {
        distance = d
        what = `${prop.what} at s=${prop.s.toFixed(0)}`
      }
    }
  }
  return { distance, what }
}

export function assertPropClearance(props: PlacedProp[], step = 4) {
  const { distance, what } = measurePropClearance(props, step)
  if (distance < MIN_PROP_CLEARANCE) {
    fail(
      `${what} is ${distance.toFixed(1)}m from another part of the centreline, minimum is ` +
        `${MIN_PROP_CLEARANCE}m. The track surface reaches ${BANDS[BANDS.length - 1].outer}m from ` +
        'the centreline, so this prop is standing on the circuit.',
    )
  }
  return distance
}

/** Metres beyond which a prop must be confirmed outside by winding number, not by normal sign alone. */
const OUTSIDE_CHECK_THRESHOLD = 20

/**
 * Props that were placed "outside the loop" by normal sign but landed INSIDE
 * it instead.
 *
 * Only meaningful once the loop is non-convex: on a convex loop `OUTSIDE_SIGN`
 * is globally valid and this never fires. Near a concave pocket it is not,
 * because the outward normal at that point curves back across the pocket at
 * the track. Only props offset far enough to matter are checked, since a
 * trackside prop within OUTSIDE_CHECK_THRESHOLD of the centreline is in no
 * danger of crossing to the far side of even a tight pocket.
 */
export function measureOutsideViolations(props: PlacedProp[]): PlacedProp[] {
  return props.filter((p) => {
    const fr = frameAt(p.s)
    const localOffset = Math.hypot(p.x - fr.x, p.z - fr.z)
    if (localOffset < OUTSIDE_CHECK_THRESHOLD) return false
    return pointInLoop(p.x, p.z)
  })
}

export function assertPropsOutside(props: PlacedProp[]) {
  const bad = measureOutsideViolations(props)
  if (bad.length > 0) {
    const first = bad[0]
    fail(
      `${bad.length} prop(s) meant to sit outside the loop are actually inside it, e.g. ` +
        `${first.what} at s=${first.s.toFixed(0)}, (${first.x.toFixed(1)}, ${first.z.toFixed(1)}). ` +
        'The outward normal is not valid this far out near a concave section; move the prop or ' +
        'reduce its offset.',
    )
  }
}

/** Everything, in the order that gives the most useful first failure. */
export function assertCircuit() {
  if (TRACK_LENGTH < 2400 || TRACK_LENGTH > 3500) {
    fail(`track is ${TRACK_LENGTH.toFixed(0)}m, the spec requires 2400 to 3500m`)
  }
  const radii = assertCornerRadii()
  assertStopsOnStraights()
  const gaps = assertStopSpread()
  const separation = assertSeparation()
  return { radii, gaps, separation }
}
