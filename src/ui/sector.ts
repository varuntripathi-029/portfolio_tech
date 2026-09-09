import { TRACK_LENGTH } from '../scene/trackLayout'

/** Track split into equal thirds. Used by the HUD and by card headers. */
export function sectorLabel(z: number): string {
  const third = TRACK_LENGTH / 3
  if (z < third) return 'Sector 1'
  if (z < third * 2) return 'Sector 2'
  return 'Sector 3'
}
