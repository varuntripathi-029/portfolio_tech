import { useRaceStore } from '../state/raceStore'
import { TIMELINE } from '../data/timeline'
import { StartSequence } from './StartSequence'
import { Hud } from './Hud'
import { EventCard } from './EventCard'
import { EndScreen } from './EndScreen'
import { Navbar } from './Navbar'
import { SpeedLines } from './SpeedLines'

/** Reads raceStore.phase and shows the matching DOM layer above the canvas. */
export function Overlay() {
  const phase = useRaceStore((s) => s.phase)
  const activeEventIndex = useRaceStore((s) => s.activeEventIndex)

  const activeEvent = phase === 'stopped' ? (TIMELINE[activeEventIndex] ?? null) : null

  return (
    <>
      {/* Always mounted: the nav is the shortcut layer, reachable from any phase. */}
      <Navbar />
      <SpeedLines />

      {phase === 'lights' && <StartSequence />}
      {phase === 'ended' && <EndScreen />}
      {phase !== 'lights' && phase !== 'ended' && (
        <>
          <Hud />
          <EventCard event={activeEvent} />
        </>
      )}
    </>
  )
}
