import { motion, useReducedMotion } from 'motion/react'
import { Panel, panelItem } from './Panel'
import { sectionById } from '../data/sections'
import { useRaceStore } from '../state/raceStore'

/**
 * STAGE 2 PLACEHOLDER.
 *
 * Just enough card to prove the section flow works end to end: the car brakes
 * to a marker, something appears, W dismisses it and the car launches. The
 * glass treatment, the paged item list and all the real content arrive in
 * Stage 4.
 */
export function SectionCard() {
  const phase = useRaceStore((s) => s.phase)
  const activeSection = useRaceStore((s) => s.activeSection)
  const reduce = useReducedMotion()

  const showing = phase === 'stopped' || phase === 'dry'
  if (!showing || !activeSection) return null

  const section = sectionById(activeSection)

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center px-6">
      <motion.div
        // Degrades to visible, never to hidden: if motion fails the reader
        // still gets the card.
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="pointer-events-auto w-[min(640px,80vw)]"
      >
        <Panel
          headerLeft={section.label}
          headerRight={
            <span className="shrink-0 font-mono text-[10px] tracking-widest text-slate uppercase">
              Stage 2 placeholder
            </span>
          }
        >
          <motion.div variants={panelItem} className="space-y-3">
            <p className="font-mono text-xs tracking-widest text-smoke uppercase">
              Section {section.id} at s={section.s.toFixed(0)}m
            </p>
            <p className="text-sm text-paper">
              Content arrives in Stage 4. The car stopped here on its own marker.
            </p>
            <p className="font-mono text-[11px] tracking-[0.22em] text-race-red uppercase">
              {section.kind === 'contact' ? 'Press W to refuel' : 'Press W to continue'}
            </p>
          </motion.div>
        </Panel>
      </motion.div>
    </div>
  )
}
