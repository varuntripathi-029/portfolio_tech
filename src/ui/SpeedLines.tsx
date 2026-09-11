import { useEffect, useRef } from 'react'
import { useCarStore } from '../state/carStore'

/**
 * Radial streaks over the canvas during a jump.
 *
 * A constant 1.5s means a 2000m jump covers ground 13x faster than a 150m one.
 * Without something selling the speed that reads as a broken teleport, so the
 * streaks peak at mid-flight and clear before arrival, leaving the deceleration
 * itself to feel controlled.
 *
 * Driven by an imperative store subscription writing straight to style: this
 * updates every frame, and a React state hook here would re-render the overlay
 * ninety times per jump for no reason.
 */
export function SpeedLines() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(
    () =>
      useCarStore.subscribe((state) => {
        const el = ref.current
        if (!el) return
        const p = state.warpProgress
        el.style.opacity = p < 0 ? '0' : String(Math.sin(p * Math.PI) * 0.8)
      }),
    [],
  )

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-10 opacity-0"
      style={{
        background:
          'repeating-conic-gradient(from 0deg at 50% 52%, rgba(247,244,241,0) 0deg, rgba(247,244,241,0.5) 0.3deg, rgba(247,244,241,0) 0.85deg)',
        // Clear at the centre so the car stays readable, streaking toward the edges.
        maskImage: 'radial-gradient(circle at 50% 52%, transparent 14%, black 68%)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 52%, transparent 14%, black 68%)',
      }}
    />
  )
}
