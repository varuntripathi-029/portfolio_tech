/**
 * Where every piece of trackside furniture goes, as (s, d) pairs.
 *
 * This is the single source of truth. The scene components read it to place
 * instances, and the plot script and the clearance assertion read the same
 * arrays, so what the SVG shows is exactly what the scene builds. A component
 * that computed its own positions could drift out of agreement with the
 * check that is supposed to be guarding it.
 *
 * Pure: arc-length maths only, no three objects, no React.
 */

import { RESOLVED, DESIGN_LENGTH } from './circuit'
import { TRACK_LENGTH, OUTSIDE_SIGN, frameAt, wrapS } from './trackFrame'
import { BARRIER_X } from '../scene/trackLayout'
import type { PlacedProp } from './assertions'

/** Design arc length to measured arc length. See sections.ts for why. */
const TO_MEASURED = TRACK_LENGTH / DESIGN_LENGTH

export interface Placement {
  s: number
  /** Lateral offset. Positive is the driver's left. */
  d: number
}

/** Verified in v1: at 8m wide, boards 50m apart read as sparse. */
export const LED_SPACING = 24
export const LED_D = OUTSIDE_SIGN * (BARRIER_X + 1)

export const MARSHAL_SPACING = 300
export const MARSHAL_D = OUTSIDE_SIGN * (BARRIER_X + 2)

export const POLE_SPACING = 60
export const POLE_D = BARRIER_X + 6

export const GRANDSTAND_SPACING = 400
/**
 * Grandstands go OUTSIDE the loop only. On the inside of a bend a prop this
 * far off the centreline lands on another part of the track.
 */
export const GRANDSTAND_D = OUTSIDE_SIGN * (BARRIER_X + 17)

export const BARRIER_SEGMENT = 4

/** Evenly spaced placements around the whole lap, wrapping cleanly. */
function around(spacing: number, d: number, offset = 0): Placement[] {
  const n = Math.round(TRACK_LENGTH / spacing)
  const step = TRACK_LENGTH / n // exact, so the wrap has no short segment
  const out: Placement[] = []
  for (let i = 0; i < n; i++) out.push({ s: wrapS(i * step + offset), d })
  return out
}

export const LED_BOARDS: Placement[] = around(LED_SPACING, LED_D, LED_SPACING / 2)
export const MARSHAL_POSTS: Placement[] = around(MARSHAL_SPACING, MARSHAL_D, 40)

export const LIGHT_POLES: Placement[] = [
  ...around(POLE_SPACING, POLE_D, 12),
  ...around(POLE_SPACING, -POLE_D, 12),
]

export const GRANDSTANDS: Placement[] = around(GRANDSTAND_SPACING, GRANDSTAND_D, 120)

/**
 * Gantries only on straights: a 36m beam square across the track reads as
 * broken if the track curves away underneath it. One per straight over 150m,
 * plus another every 200m inside the long ones.
 */
export const GANTRIES: Placement[] = (() => {
  const out: Placement[] = []
  for (const seg of RESOLVED) {
    if (seg.kind !== 'straight' || seg.length < 150) continue
    const count = Math.max(1, Math.floor(seg.length / 200))
    for (let i = 0; i < count; i++) {
      const into = (seg.length * (i + 0.5)) / count
      out.push({ s: wrapS((seg.start + into) * TO_MEASURED), d: 0 })
    }
  }
  return out
})()

/** Barrier segments, both sides, stepped so the wrap has no short piece. */
export const BARRIERS: Placement[] = (() => {
  const n = Math.round(TRACK_LENGTH / BARRIER_SEGMENT)
  const step = TRACK_LENGTH / n
  const out: Placement[] = []
  for (let i = 0; i < n; i++) {
    const s = wrapS(i * step + step / 2)
    out.push({ s, d: BARRIER_X })
    out.push({ s, d: -BARRIER_X })
  }
  return out
})()

/** Actual barrier segment length, after the wrap-exact adjustment. */
export const BARRIER_STEP = TRACK_LENGTH / Math.round(TRACK_LENGTH / BARRIER_SEGMENT)

/** World position of a placement. */
export function worldOf(p: Placement): { x: number; z: number } {
  const fr = frameAt(p.s)
  return { x: fr.x + fr.lx * p.d, z: fr.z + fr.lz * p.d }
}

/**
 * Everything discrete, for the clearance assertion and the plot.
 *
 * Barriers are excluded on purpose: they trace the track envelope itself, so
 * "is this barrier near the track" is not a meaningful question. The
 * separation assertion already guarantees two barrier lines cannot meet, and
 * it uses a 60m minimum against a 17m offset.
 */
export function collectProps(): PlacedProp[] {
  const out: PlacedProp[] = []
  const add = (list: Placement[], what: string) => {
    for (const p of list) {
      const w = worldOf(p)
      out.push({ x: w.x, z: w.z, s: p.s, what })
    }
  }
  add(LED_BOARDS, 'LED board')
  add(GANTRIES, 'gantry')
  add(LIGHT_POLES, 'light pole')
  add(MARSHAL_POSTS, 'marshal post')
  add(GRANDSTANDS, 'grandstand')
  return out
}

/**
 * Props placed outside the loop by `OUTSIDE_SIGN`, for the winding-number
 * check in `assertPropsOutside`.
 *
 * Grandstands are the only entry today: at 34m off the centreline they are
 * the one prop far enough out for "outside" to be a meaningful question on a
 * non-convex loop. LED boards and marshal posts sit at 18 to 19m, under the
 * 20m threshold that check applies, so they are left out on purpose.
 */
export function collectOutsideProps(): PlacedProp[] {
  return GRANDSTANDS.map((p) => {
    const w = worldOf(p)
    return { x: w.x, z: w.z, s: p.s, what: 'grandstand' }
  })
}
