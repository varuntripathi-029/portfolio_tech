import { motion, useReducedMotion } from 'motion/react'
import { FiArrowUpRight } from 'react-icons/fi'
import type { NavGroup, NavRow } from './navData'

/**
 * Deliberately not full screen. The gap at the left and right edges is what
 * keeps this reading as an overlay on a live scene rather than a page
 * navigation, so the track stays visible while the menu is open.
 */
export function MegaMenu({
  group,
  onPick,
}: {
  group: NavGroup
  onPick: (row: NavRow) => void
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="pointer-events-auto mx-auto w-[76vw] max-w-[1200px]"
    >
      <div className="chamfer-panel hud-noise relative border-t-2 border-race-red bg-[rgba(21,21,30,0.82)] backdrop-blur-[6px]">
        <div className="flex items-baseline justify-between px-6 pt-4 pb-3">
          <span className="font-mono text-[11px] tracking-[0.22em] text-smoke uppercase">
            {group.label}
          </span>
          <span className="tabular font-mono text-[10px] tracking-widest text-slate uppercase">
            {group.rows.length} {group.rows.length === 1 ? 'stop' : 'stops'}
          </span>
        </div>

        <ul className="pb-3">
          {group.rows.map((row) => (
            <li key={`${row.label}-${row.year}`}>
              <button
                type="button"
                onClick={() => onPick(row)}
                className="group grid w-full grid-cols-[7.5rem_1fr_auto] items-baseline gap-4 px-6 py-2.5 text-left transition-colors hover:bg-[rgba(247,244,241,0.05)]"
              >
                {/* Timing column. */}
                <span className="tabular font-mono text-[11px] tracking-widest text-slate uppercase transition-colors group-hover:text-[var(--color-hud-cyan)]">
                  {row.year}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-paper">{row.label}</span>
                  {/* One line only. A dropdown that satisfies the reader means
                      nobody drives and the 3D becomes decoration. */}
                  <span className="block truncate text-xs text-smoke">{row.note}</span>
                </span>
                <FiArrowUpRight
                  aria-hidden
                  className="mt-0.5 text-slate transition-colors group-hover:text-paper"
                />
              </button>
            </li>
          ))}
        </ul>

        <p className="border-t border-slate px-6 py-2.5 font-mono text-[10px] tracking-[0.2em] text-slate uppercase">
          Select to fly there
        </p>
      </div>
    </motion.div>
  )
}
