import { useEffect } from 'react'
import { Panel, panelItem } from './Panel'
import { motion } from 'motion/react'
import { useRaceStore } from '../state/raceStore'
import { useIsTouchDevice } from './useTouch'

const KEY_ROWS_DESKTOP: { key: string; action: string }[] = [
  { key: 'W', action: 'Throttle' },
  { key: 'S', action: 'Brake and reverse' },
  { key: 'A / D', action: 'Steer' },
  { key: 'SPACE', action: 'Drift' },
  { key: '← →', action: 'Page cards' },
  { key: 'M', action: 'Mute' },
]

/**
 * Onboarding, before DRIVER. Shown once (raceStore's `tutorialSeen`, backed
 * by localStorage) and reopenable from the navbar's "How to drive" entry.
 * Real glass, same Panel every card uses; the navbar stays clickable over it
 * since this is a normal DOM overlay, not a modal that steals the whole page.
 */
export function Tutorial() {
  const tutorialSeen = useRaceStore((s) => s.tutorialSeen)
  const dismissTutorial = useRaceStore((s) => s.dismissTutorial)
  const isTouch = useIsTouchDevice()

  useEffect(() => {
    if (tutorialSeen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') dismissTutorial()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tutorialSeen, dismissTutorial])

  if (tutorialSeen) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="pointer-events-auto w-[min(560px,88vw)]"
      >
        <Panel headerLeft="Tutorial">
          <motion.div variants={panelItem} className="space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-paper uppercase">
              {isTouch ? 'One lap, on your phone' : 'One lap, your way'}
            </h2>

            {isTouch ? (
              <ul className="space-y-2 text-base text-paper">
                <li>The car drives itself, stopping at every section.</li>
                <li>Tap anywhere to continue past a card.</li>
                <li>Use the menu button, top right, to jump anywhere.</li>
              </ul>
            ) : (
              <ul className="space-y-2">
                {KEY_ROWS_DESKTOP.map((row) => (
                  <li key={row.key} className="flex items-baseline gap-3">
                    <span className="chamfer-sm inline-block min-w-[4.5rem] border border-slate px-2 py-1 text-center font-mono text-xs font-bold text-[var(--color-hud-cyan)] uppercase">
                      {row.key}
                    </span>
                    <span className="text-base text-paper">{row.action}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="font-mono text-xs tracking-widest text-smoke uppercase">
              In a hurry? Jump anywhere from the top bar.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => dismissTutorial()}
                className="focus-ring chamfer-sm border border-[var(--color-hud-cyan)] px-5 py-3 font-mono text-sm font-bold tracking-widest text-[var(--color-hud-cyan)] uppercase transition-all hover:bg-[rgba(0,224,255,0.1)] hover:shadow-[0_0_16px_rgba(0,224,255,0.4)]"
              >
                {isTouch ? 'Tap to continue' : 'Enter to continue'}
              </button>
              <button
                type="button"
                onClick={() => dismissTutorial()}
                className="focus-ring chamfer-sm border border-slate px-5 py-3 font-mono text-sm text-smoke uppercase transition-colors hover:text-paper"
              >
                Skip
              </button>
            </div>
          </motion.div>
        </Panel>
      </motion.div>
    </div>
  )
}
