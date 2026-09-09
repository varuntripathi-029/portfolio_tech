import type { ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'motion/react'

/**
 * The F1 broadcast HUD panel every overlay in the project is built from.
 *
 * Three choices carry most of the look:
 *  - Corner brackets instead of a full border. Four L marks read as a
 *    targeting frame; a box outline reads as a div.
 *  - Functional transparency. The track stays faintly visible moving behind
 *    the panel, which is the point. This is an overlay on a live scene, not
 *    frosted glass for its own sake.
 *  - Staggered assembly. Brackets snap, then header, then body. A panel that
 *    builds itself reads as telemetry acquiring lock.
 */

const CONTAINER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

const BRACKET: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.18, ease: 'easeOut' } },
}

/** Spread onto any motion element inside a Panel to join the stagger. */
export const panelItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
}

const BRACKET_BASE = 'pointer-events-none absolute h-5 w-5 border-race-red'

/**
 * Only the two square corners carry brackets. The chamfer cuts the top-right
 * and bottom-left, and brackets are drawn outside the clip path, so a bracket
 * on a cut corner would float in empty space.
 */
function CornerBrackets() {
  return (
    <>
      <motion.span variants={BRACKET} className={`${BRACKET_BASE} top-0 left-0 border-t border-l`} />
      <motion.span
        variants={BRACKET}
        className={`${BRACKET_BASE} right-0 bottom-0 border-r border-b`}
      />
    </>
  )
}

interface PanelProps {
  /** Left of the header strip. Kept short, it is a locator not a title. */
  headerLeft: ReactNode
  /** Right of the header strip. Usually a status chip. */
  headerRight?: ReactNode
  /** Width and layout overrides. */
  className?: string
  children: ReactNode
}

export function Panel({ headerLeft, headerRight, className = '', children }: PanelProps) {
  // The panel mounts hidden and relies on motion to reveal it, so a skipped or
  // interrupted animation would leave a blank card. initial={false} mounts
  // straight at the animate state, and children inheriting these variants skip
  // their entrance with it.
  const reduce = useReducedMotion()

  return (
    <motion.div
      variants={CONTAINER}
      initial={reduce ? false : 'hidden'}
      animate="show"
      className={`relative ${className}`}
    >
      <div className="chamfer-panel hud-noise relative bg-[rgba(21,21,30,0.82)] backdrop-blur-[6px]">
        <motion.div variants={panelItem}>
          <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
            <span className="font-mono text-[11px] tracking-[0.22em] text-smoke uppercase">
              {headerLeft}
            </span>
            {headerRight}
          </div>
          {/* The one red rule on the panel. Red marks the frame, never fills. */}
          <div className="h-0.5 w-full bg-race-red" />
        </motion.div>

        <div className="max-h-[74vh] overflow-y-auto px-5 py-5">{children}</div>
      </div>

      <CornerBrackets />
    </motion.div>
  )
}
