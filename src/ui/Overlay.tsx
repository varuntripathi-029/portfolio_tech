import { useRaceStore } from '../state/raceStore'
import { StartSequence } from './StartSequence'
import { SectionCard } from './SectionCard'
import { Navbar } from './Navbar'
import { SpeedLines } from './SpeedLines'

/** Reads raceStore.phase and shows the matching DOM layer above the canvas. */
export function Overlay() {
  const phase = useRaceStore((s) => s.phase)

  return (
    <>
      {/* Always mounted: the nav is the shortcut layer, reachable from any phase. */}
      <Navbar />
      <SpeedLines />

      {(phase === 'lights' || phase === 'launching') && <StartSequence />}
      <SectionCard />
    </>
  )
}
