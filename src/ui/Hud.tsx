import { useCarStore } from '../state/carStore'
import { sectorLabel } from './sector'

/** Name plus sector, small and clean. No speed, gear, lap, or timing tower. */
export function Hud() {
  // Selecting the derived label (not raw z) means this only re-renders when
  // the sector actually changes, not on every physics tick.
  const sector = useCarStore((s) => sectorLabel(s.z))

  return (
    // The name lives in the navbar now, so this is the sector alone.
    <div className="pointer-events-none fixed top-24 left-6 z-10">
      <p className="font-mono text-xs tracking-widest text-paper uppercase">{sector}</p>
    </div>
  )
}
