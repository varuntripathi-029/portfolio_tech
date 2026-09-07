import { useCarStore } from '../state/carStore'
import { TRACK_LENGTH } from '../scene/trackLayout'

function sectorLabel(z: number): string {
  const third = TRACK_LENGTH / 3
  if (z < third) return 'Sector 1'
  if (z < third * 2) return 'Sector 2'
  return 'Sector 3'
}

/** Name plus sector, small and clean. No speed, gear, lap, or timing tower. */
export function Hud() {
  // Selecting the derived label (not raw z) means this only re-renders when
  // the sector actually changes, not on every physics tick.
  const sector = useCarStore((s) => sectorLabel(s.z))

  return (
    <div className="pointer-events-none fixed top-6 left-6 z-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-smoke">Varun Tripathi</p>
      <p className="mt-0.5 font-mono text-xs uppercase tracking-widest text-paper">{sector}</p>
    </div>
  )
}
