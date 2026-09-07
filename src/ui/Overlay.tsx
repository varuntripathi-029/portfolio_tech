import { useRaceStore } from '../state/raceStore'
import { TIMELINE } from '../data/timeline'
import { StartSequence } from './StartSequence'
import { Hud } from './Hud'
import { EventCard } from './EventCard'
import { EndScreen } from './EndScreen'

/** Reads raceStore.phase and shows the matching DOM layer above the canvas. */
export function Overlay() {
  const phase = useRaceStore((s) => s.phase)
  const activeEventIndex = useRaceStore((s) => s.activeEventIndex)

  if (phase === 'lights') return <StartSequence />
  if (phase === 'ended') return <EndScreen />

  const activeEvent = phase === 'stopped' ? (TIMELINE[activeEventIndex] ?? null) : null

  return (
    <>
      <Hud />
      <EventCard event={activeEvent} />
    </>
  )
}
