import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useReducedMotion } from 'motion/react'

/**
 * The React Bits PillNav hover mechanic, rebuilt.
 *
 * Kept: a circle wipes up from below the item while two stacked copies of the
 * label slide, so the second copy arrives in the inverted colour exactly as the
 * red fills behind it. That interplay is a gsap timeline and porting it to
 * `motion` would lose the feel for no real saving, which is why gsap is
 * unbanned here and nowhere else.
 *
 * Changed: no border-radius. The design system bans fully rounded pills, so the
 * shell is a chamfered rectangle matching the card language. No href and no
 * router either: every item is a jump action that moves the car.
 */
export function NavPill({
  label,
  open,
  onHover,
  onFocus,
  onSelect,
  children,
}: {
  label: string
  open: boolean
  onHover: () => void
  /** Keyboard arrival. Separate from onHover because hover is intent-delayed. */
  onFocus: () => void
  onSelect: () => void
  children?: React.ReactNode
}) {
  const circle = useRef<HTMLSpanElement>(null)
  const stack = useRef<HTMLSpanElement>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const duration = reduce ? 0 : 0.42
    gsap.set(circle.current, { xPercent: -50, yPercent: 50, scale: 0, transformOrigin: '50% 50%' })
    gsap.set(stack.current, { yPercent: 0 })

    const tl = gsap.timeline({ paused: true })
    tl.to(circle.current, { scale: 1.3, duration, ease: 'power3.out' }, 0)
    // The stack is two labels tall, so -50% swaps one for the other.
    tl.to(stack.current, { yPercent: -50, duration, ease: 'power3.out' }, 0)
    timeline.current = tl

    return () => {
      tl.kill()
    }
  }, [reduce])

  useEffect(() => {
    const tl = timeline.current
    if (!tl) return
    if (open) tl.play()
    else tl.reverse()
  }, [open])

  return (
    <button
      type="button"
      aria-expanded={open}
      onMouseEnter={onHover}
      onFocus={onFocus}
      onClick={onSelect}
      className="focus-ring chamfer-sm relative overflow-hidden border border-slate px-5 py-2 font-mono text-[11px] tracking-[0.18em] uppercase"
    >
      <span
        ref={circle}
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 aspect-square w-[160%] rounded-full bg-race-red"
      />
      <span className="relative block h-[1.15em] overflow-hidden">
        <span ref={stack} className="flex flex-col">
          <span className="flex h-[1.15em] items-center justify-center text-paper">{label}</span>
          {/* The arriving copy sits on red, so it inverts to the dark base. */}
          <span className="flex h-[1.15em] items-center justify-center text-carbon">{label}</span>
        </span>
      </span>
      {children}
    </button>
  )
}
