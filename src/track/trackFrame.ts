/**
 * The one arc-length table. Everything in the scene is placed through this,
 * and nothing else is allowed to do its own curve maths.
 *
 * Pure by contract: only three's core maths is imported, nothing touching
 * window, document, React or drei, because scripts/simulateLap.ts imports
 * this in Node.
 */

import { CatmullRomCurve3, Vector3 } from 'three'
import { buildControlPoints } from './circuit'

/** Table resolution in metres. */
export const SAMPLE_STEP = 0.5

export interface TrackFrame {
  x: number
  z: number
  /** Unit tangent, the direction of travel. */
  tx: number
  tz: number
  /** Unit left normal = cross(up, tangent). Positive lateral offset d is this way. */
  lx: number
  lz: number
  /** Signed curvature, 1/metres. Sign follows the turn direction. */
  curvature: number
}

/**
 * How much curvature is averaged, in samples either side.
 *
 * The spline runs through control points 12m apart, so curvature ripples
 * slightly within each span even along a constant-radius arc. Averaging over
 * +/-2m flattens that without touching real radius changes, which happen over
 * tens of metres.
 */
const CURVATURE_WINDOW = 4

function build() {
  const cps = buildControlPoints().map((p) => new Vector3(p.x, 0, p.z))
  // Centripetal specifically: uniform and chordal both cusp on unevenly
  // spaced points, which is the one failure this track cannot have.
  const curve = new CatmullRomCurve3(cps, true, 'centripetal')

  // Dense chord walk first, to get a u -> arc length mapping.
  const DENSE = Math.max(8000, cps.length * 200)
  const px: number[] = new Array(DENSE + 1)
  const pz: number[] = new Array(DENSE + 1)
  const cum: number[] = new Array(DENSE + 1)
  const tmp = new Vector3()
  for (let i = 0; i <= DENSE; i++) {
    curve.getPoint(i / DENSE, tmp)
    px[i] = tmp.x
    pz[i] = tmp.z
    cum[i] = i === 0 ? 0 : cum[i - 1] + Math.hypot(tmp.x - px[i - 1], tmp.z - pz[i - 1])
  }
  const length = cum[DENSE]

  // Resample at fixed arc length.
  const count = Math.round(length / SAMPLE_STEP)
  const step = length / count // exact, so count * step === length
  const sx = new Float64Array(count)
  const sz = new Float64Array(count)

  let cursor = 0
  for (let i = 0; i < count; i++) {
    const target = i * step
    while (cursor < DENSE - 1 && cum[cursor + 1] < target) cursor++
    const span = cum[cursor + 1] - cum[cursor]
    const f = span > 1e-12 ? (target - cum[cursor]) / span : 0
    sx[i] = px[cursor] + (px[cursor + 1] - px[cursor]) * f
    sz[i] = pz[cursor] + (pz[cursor + 1] - pz[cursor]) * f
  }

  // Tangents by central difference. The table is arc-length parameterised, so
  // the difference is already close to unit length; normalise anyway.
  const tx = new Float64Array(count)
  const tz = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    const a = (i - 1 + count) % count
    const b = (i + 1) % count
    const dx = sx[b] - sx[a]
    const dz = sz[b] - sz[a]
    const m = Math.hypot(dx, dz) || 1
    tx[i] = dx / m
    tz[i] = dz / m
  }

  // Signed curvature as the rate of heading change: kappa = dtheta / ds.
  // Taken from the tangent angles rather than a second derivative of
  // position, which is far noisier at 0.5m spacing.
  const raw = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    const a = (i - 1 + count) % count
    const b = (i + 1) % count
    // Signed angle from tangent[a] to tangent[b], via the 2D cross and dot.
    const cross = tx[a] * tz[b] - tz[a] * tx[b]
    const dot = tx[a] * tx[b] + tz[a] * tz[b]
    raw[i] = Math.atan2(cross, dot) / (2 * step)
  }

  const curvature = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    let sum = 0
    for (let k = -CURVATURE_WINDOW; k <= CURVATURE_WINDOW; k++) {
      sum += raw[(i + k + count) % count]
    }
    curvature[i] = sum / (CURVATURE_WINDOW * 2 + 1)
  }

  // Winding, by the shoelace formula. For a counter-clockwise loop in (x, z)
  // the left normal points away from the enclosed area, so positive d is
  // outside; for a clockwise loop it is the other way round.
  let area2 = 0
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count
    area2 += sx[i] * sz[j] - sx[j] * sz[i]
  }
  const signedArea = area2 / 2

  return { count, step, length, sx, sz, tx, tz, curvature, signedArea }
}

const T = build()

/** Total centreline length in metres. */
export const TRACK_LENGTH = T.length
/** Number of samples in the table. */
export const SAMPLE_COUNT = T.count
/**
 * Which sign of lateral offset d points OUTSIDE the loop. Tall props go on
 * that side only: on the inside of a bend a large offset lands on another
 * part of the track.
 */
export const OUTSIDE_SIGN: 1 | -1 = T.signedArea > 0 ? 1 : -1
export const SIGNED_AREA = T.signedArea

/** Wraps any arc length into [0, TRACK_LENGTH). */
export function wrapS(s: number): number {
  const r = s % T.length
  return r < 0 ? r + T.length : r
}

/**
 * Shortest signed distance from a to b along the loop, in (-L/2, L/2].
 * Positive means b is ahead of a.
 */
export function deltaS(a: number, b: number): number {
  let d = wrapS(b) - wrapS(a)
  if (d > T.length / 2) d -= T.length
  if (d < -T.length / 2) d += T.length
  return d
}

const scratch: TrackFrame = { x: 0, z: 0, tx: 0, tz: 0, lx: 0, lz: 0, curvature: 0 }

/**
 * The frame at arc length s, wrapped. Interpolates between table samples.
 *
 * Pass `out` in per-frame code to avoid allocating; the default is a shared
 * scratch object, so never hold on to the returned reference.
 */
export function frameAt(s: number, out: TrackFrame = scratch): TrackFrame {
  const u = wrapS(s) / T.step
  const i = Math.floor(u)
  const f = u - i
  const a = i % T.count
  const b = (i + 1) % T.count

  out.x = T.sx[a] + (T.sx[b] - T.sx[a]) * f
  out.z = T.sz[a] + (T.sz[b] - T.sz[a]) * f

  const dx = T.tx[a] + (T.tx[b] - T.tx[a]) * f
  const dz = T.tz[a] + (T.tz[b] - T.tz[a]) * f
  const m = Math.hypot(dx, dz) || 1
  out.tx = dx / m
  out.tz = dz / m

  // left = cross(up, tangent) with up = +Y, which is (tz, 0, -tx).
  // For a car heading +Z that gives +X, matching v1's "positive X is the
  // driver's left" convention.
  out.lx = out.tz
  out.lz = -out.tx

  out.curvature = T.curvature[a] + (T.curvature[b] - T.curvature[a]) * f
  return out
}

/** World position at arc length s and lateral offset d. */
export function positionAt(s: number, d: number, out?: TrackFrame): { x: number; z: number } {
  const fr = frameAt(s, out)
  return { x: fr.x + fr.lx * d, z: fr.z + fr.lz * d }
}

/** Heading in radians for a tangent, usable directly as a Y rotation. */
export function headingAt(s: number): number {
  const fr = frameAt(s)
  // The car model faces +Z, so a heading of 0 means tangent (0, 1).
  return Math.atan2(fr.tx, fr.tz)
}

/** Raw sample access, for the plot script and the minimap path. */
export function centreline(stepMetres = 5): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = []
  for (let s = 0; s < T.length; s += stepMetres) {
    const fr = frameAt(s)
    out.push({ x: fr.x, z: fr.z })
  }
  return out
}

/** Curvature extremes, for reporting. */
export function curvatureAt(s: number): number {
  return frameAt(s).curvature
}

/**
 * Whether (x, z) sits inside the loop, by winding number against the sampled
 * centreline.
 *
 * `OUTSIDE_SIGN` alone is only valid for props placed CLOSE to the track: it
 * is one global sign flip, but "which way is outside" is a purely LOCAL
 * question once the loop is non-convex. At a concave pocket, the outward
 * normal points back across the pocket at the track itself, so a prop offset
 * far enough out by normal sign can land inside the loop despite "outside"
 * being exactly what was intended. Anything placed more than about 20m off
 * the centreline should be confirmed with this, not with the sign alone.
 *
 * Standard winding-number test (Sunday): walk the polygon edges, count signed
 * crossings of the horizontal ray at z = query z. Inside iff the total is
 * nonzero. Robust for a simple (non-self-intersecting) polygon regardless of
 * winding direction, which is exactly what the separation assertion already
 * guarantees the centreline is.
 */
export function pointInLoop(x: number, z: number, stepMetres = 5): boolean {
  const poly = centreline(stepMetres)
  const n = poly.length
  let wn = 0
  const isLeft = (a: { x: number; z: number }, b: { x: number; z: number }) =>
    (b.x - a.x) * (z - a.z) - (x - a.x) * (b.z - a.z)

  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    if (a.z <= z) {
      if (b.z > z && isLeft(a, b) > 0) wn++
    } else {
      if (b.z <= z && isLeft(a, b) < 0) wn--
    }
  }
  return wn !== 0
}
