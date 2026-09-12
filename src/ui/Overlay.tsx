import { useRaceStore } from '../state/raceStore'
import { StartSequence } from './StartSequence'
import { SectionCard } from './SectionCard'
import { Navbar } from './Navbar'
import { SpeedLines } from './SpeedLines'
import { Minimap } from './Minimap'
import { Dashboard } from './Dashboard'
import { AudioEngine } from '../audio/AudioEngine'
import { Tutorial } from './Tutorial'

/** Reads raceStore.phase and shows the matching DOM layer above the canvas. */
export function Overlay() {
  const phase = useRaceStore((s) => s.phase)

  return (
    <>
      {/* Always mounted: the nav is the shortcut layer, reachable from any phase. */}
      <Navbar />
      <SpeedLines />
      <Minimap />
      <Dashboard />
      <AudioEngine />

      {(phase === 'lights' || phase === 'launching') && <StartSequence />}
      <SectionCard />
      {/* On top of everything else, but the navbar above still receives
          clicks: this is a plain overlay, never a modal that traps focus. */}
      <Tutorial />
    </>
  )
}
