import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { FiArrowUpRight } from 'react-icons/fi'
import { SURFACE_BLUR, SURFACE_FLAT } from './surface'
import type { NavGroup, NavRow } from './navData'

/**
 * Deliberately not full screen. The gap at the left and right edges is what
 * keeps this reading as an overlay on a live scene rather than a page
 * navigation, so the track stays visible while the menu is open.
 *
 * The panel is mounted once and stays mounted while any group is open: moving
 * between groups cross-fades the row list and animates the height instead of
 * tearing the whole surface down and rebuilding it, which read as a flicker.
 * `mode="popLayout"` is what makes it a true cross-fade rather than a
 * sequential swap: the outgoing list is pulled out of flow so the incoming one
 * takes the layout immediately, and `layout` on the body animates the
 * resulting height change.
 */
export function MegaMenu({
  group,
  onPick,
  blur,
}: {
  group: NavGroup
  onPick: (row: NavRow) => void
  /** False when a card owns the single allowed backdrop-filter surface. */
  blur: boolean
}) {
  const reduce = useReducedMotion()
  const fade = { duration: reduce ? 0 : 0.16 }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="pointer-events-auto mx-auto w-[76vw] max-w-[1200px]"
    >
      <div
        className={`chamfer-panel hud-noise relative border-t-2 border-race-red ${
          blur ? SURFACE_BLUR : SURFACE_FLAT
        }`}
      >
        {/* Fixed height, so the two header copies simply stack and fade. */}
        <div className="relative h-11">
          <AnimatePresence initial={false}>
            <motion.div
              key={group.id}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              className="absolute inset-x-6 top-4 flex items-baseline justify-between"
            >
              <span className="font-mono text-[11px] tracking-[0.22em] text-smoke uppercase">
                {group.label}
              </span>
              <span className="tabular font-mono text-[10px] tracking-widest text-slate uppercase">
                {group.rows.length} {group.rows.length === 1 ? 'stop' : 'stops'}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          layout
          transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }}
          className="relative overflow-hidden"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.ul
              key={group.id}
              data-group={group.id}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              className="w-full pb-3"
            >
              {group.rows.map((row) => (
                <li key={`${row.label}-${row.year}`}>
                  <button
                    type="button"
                    onClick={() => onPick(row)}
                    className="focus-ring group grid w-full grid-cols-[7.5rem_1fr_auto] items-baseline gap-4 px-6 py-2.5 text-left transition-colors hover:bg-[rgba(247,244,241,0.05)]"
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
            </motion.ul>
          </AnimatePresence>
        </motion.div>

        <p className="border-t border-slate px-6 py-2.5 font-mono text-[10px] tracking-[0.2em] text-slate uppercase">
          Arrow keys to move, Enter to fly there
        </p>
      </div>
    </motion.div>
  )
}
