/**
 * Track cross-section. Units are metres, measured outward from the
 * centreline of the curve (lateral offset d = 0), mirrored to both sides.
 *
 * Widths are deliberately compressed from real F1 run-off (15-30m) to
 * keep the LED boards and section boards inside camera frame.
 * Do not "correct" these to realistic values.
 *
 *    0 --- 6      TRACK    asphalt_track       tile 4m   receives shadow
 *    6 --- 7      KERB     procedural          tile 2m   receives shadow
 *    7 --- 10     RUNOFF   concrete_pavement   tile 4m
 *   10 --- 13     GRAVEL   gravel_floor_02     tile 3m
 *   13 --- 17     GRASS    sparse_grass        tile 2m
 *          17     BARRIER  TecPro line
 *
 * This file stays a leaf: constants only, no curve maths, no imports. The
 * arc-length table in src/track imports it, so it must not import back.
 */

export const BARRIER_X = 17

export type BandId = 'track' | 'kerb' | 'runoff' | 'gravel' | 'grass'

export interface Band {
  id: BandId
  /** Distance from centreline where the band starts. */
  inner: number
  /** Distance from centreline where the band ends. */
  outer: number
  /** Metres of world space covered by one texture tile. */
  tile: number
  /** Folder under /public/textures/. Null means procedural (kerb). */
  dir: string | null
  /** Only surfaces the car's shadow can land on receive it. */
  receiveShadow: boolean
  /** Height above y=0. Distinct per band so shared edges do not z-fight. */
  y: number
}

export const BANDS: Band[] = [
  { id: 'track', inner: 0, outer: 6, tile: 4, dir: 'asphalt_track', receiveShadow: true, y: 0 },
  { id: 'kerb', inner: 6, outer: 7, tile: 2, dir: null, receiveShadow: true, y: 0.002 },
  { id: 'runoff', inner: 7, outer: 10, tile: 4, dir: 'concrete_pavement', receiveShadow: false, y: 0.004 },
  { id: 'gravel', inner: 10, outer: 13, tile: 3, dir: 'gravel_floor_02', receiveShadow: false, y: 0.006 },
  { id: 'grass', inner: 13, outer: 17, tile: 2, dir: 'sparse_grass', receiveShadow: false, y: 0.008 },
]

export function bandById(id: BandId): Band {
  const found = BANDS.find((b) => b.id === id)
  if (!found) throw new Error(`trackLayout: no band "${id}"`)
  return found
}

/** Half the track surface width, so d in [-TRACK_HALF, TRACK_HALF] is asphalt. */
export const TRACK_HALF = bandById('track').outer
/** Inner and outer edges of the kerb, which is what the rumble tests against. */
export const KERB_INNER = bandById('kerb').inner
export const KERB_OUTER = bandById('kerb').outer
