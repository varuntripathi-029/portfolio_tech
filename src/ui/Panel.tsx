import { useRef, type PointerEvent, type ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { SURFACE_BLUR, SURFACE_FLAT } from './surface'
import { useIsTouchDevice } from './useTouch'

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

/** Tilt cap in degrees, per spec 10.4: four, not more, or 17px body copy at a
 * steeper angle gets hard to read and it stops reading as material. */
const TILT_MAX = 4

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
  const frame = useRef<HTMLDivElement>(null)
  // Block G4: flatten the card blur on touch, part of "lighter render".
  const isTouch = useIsTouchDevice()

  // Hover light and tilt share one pointer listener and write straight to CSS
  // custom properties on the DOM node, never to React state: a hover effect
  // fires on every pointer move, and re-rendering the whole card tree for that
  // would be the DOM equivalent of the per-frame-React-state trap the HUD
  // already avoids (see SpeedLines/Minimap/Dashboard).
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce || !frame.current) return
    const rect = frame.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    frame.current.style.setProperty('--glow-x', `${px * 100}%`)
    frame.current.style.setProperty('--glow-y', `${py * 100}%`)
    frame.current.style.setProperty('--tilt-x', `${(0.5 - py) * TILT_MAX * 2}deg`)
    frame.current.style.setProperty('--tilt-y', `${(px - 0.5) * TILT_MAX * 2}deg`)
  }
  function onPointerLeave() {
    if (!frame.current) return
    frame.current.style.setProperty('--tilt-x', '0deg')
    frame.current.style.setProperty('--tilt-y', '0deg')
  }

  return (
    <motion.div
      variants={CONTAINER}
      initial={reduce ? false : 'hidden'}
      animate="show"
      className={`relative ${className}`}
    >
      <div
        ref={frame}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        // Real backdrop-filter glass, per Block F's explicit request.
        // Block D had flattened this to SURFACE_FLAT after a PERF GUARD
        // reading below 60fps; re-measured with the restored blur below and
        // logged in FINAL2_NOTES.md's Block F entry rather than silently
        // reverting the earlier decision.
        // Block G5: a true CSS gradient border does not compose with the
        // chamfer clip-path, so this approximates one with two stacked inset
        // shadows -- a bright line along the top edge (the "gradient
        // border"'s ~18% end) and a much fainter one all the way round (its
        // ~4% end), plus a third, tighter inset that reads as the separate
        // top highlight the brief also asks for.
        className={`chamfer-panel hud-noise group relative ${isTouch ? SURFACE_FLAT : SURFACE_BLUR} shadow-[inset_0_1px_0_rgba(247,244,241,0.18),inset_0_0_0_1px_rgba(247,244,241,0.04),inset_0_2px_1px_-1px_rgba(247,244,241,0.25)] transition-[transform,box-shadow] duration-150 ease-out hover:shadow-[inset_0_1px_0_rgba(247,244,241,0.18),inset_0_0_0_1px_rgba(247,244,241,0.04),inset_0_2px_1px_-1px_rgba(247,244,241,0.25),0_0_36px_rgba(0,224,255,0.14)]`}
        style={
          reduce
            ? undefined
            : {
                transform:
                  'perspective(900px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))',
              }
        }
      >
        {/* Hover light: follows the cursor across the glass. Never a static
            glow, per spec 10.2, since glow is reserved for live/interactive
            surfaces. */}
        {!reduce && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                'radial-gradient(380px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(247,244,241,0.14), transparent 70%)',
            }}
          />
        )}

        {/* Arrival flash: a light sweeping the edge, on the beat the panel
            mounts (which, for SectionCard, is the beat the car stops). */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10"
            initial={{ x: '-120%', opacity: 0 }}
            animate={{ x: '120%', opacity: [0, 0.5, 0] }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              background:
                'linear-gradient(75deg, transparent 40%, rgba(225,6,0,0.25) 50%, transparent 60%)',
            }}
          />
        )}

        <motion.div variants={panelItem} className="relative z-10">
          <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
            <span className="font-mono text-[11px] tracking-[0.22em] text-smoke uppercase">
              {headerLeft}
            </span>
            {headerRight}
          </div>
          {/* The one red rule on the panel. Red marks the frame, never fills. */}
          <div className="h-0.5 w-full bg-race-red" />
        </motion.div>

        <div className="relative z-10 max-h-[74vh] overflow-y-auto px-5 py-5">{children}</div>
      </div>

      <CornerBrackets />
    </motion.div>
  )
}
