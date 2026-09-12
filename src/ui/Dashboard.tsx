import { useEffect, useRef } from 'react'
import { useCarStore } from '../state/carStore'
import { useRaceStore } from '../state/raceStore'
import { TOP_SPEED, GEAR_COUNT } from '../sim/car'

/** Arc geometry for the speed readout, an SVG stroke-dasharray sweep. */
const ARC_RADIUS = 42
const ARC_CIRC = 2 * Math.PI * ARC_RADIUS
// A 270-degree sweep (start at -225deg, i.e. 7:30 o'clock) reads as a
// dashboard dial rather than a full closed ring.
const ARC_FRACTION = 0.75

/** Shift-light thresholds as fractions of the idle-to-redline band, climbing
 * green then red then blue, F1 style. */
const IDLE_RPM = 2500
const REDLINE_RPM = 12000
const SHIFT_LIGHTS: { at: number; color: string }[] = [
  { at: 0.5, color: 'var(--color-flag-green)' },
  { at: 0.62, color: 'var(--color-flag-green)' },
  { at: 0.74, color: 'var(--color-race-red)' },
  { at: 0.86, color: 'var(--color-race-red)' },
  { at: 0.95, color: 'var(--color-flag-blue)' },
]

/** mm:ss.mmm, per the brief. Not `.toFixed` on a seconds float: that rounds
 * instead of truncating, so the last digit occasionally jumps by more than
 * one between frames. */
function formatLap(ms: number): string {
  const totalMs = Math.max(0, Math.floor(ms))
  const minutes = Math.floor(totalMs / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const millis = totalMs % 1000
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

/**
 * Bottom-right: speed arc, digital km/h, gear, F1 shift lights, fuel bar,
 * lap timer, and a small drift-score popup.
 *
 * Reads straight from the sim state via an imperative store subscription,
 * never React state per frame. Fake glass, same reasoning as Minimap.
 */
export function Dashboard() {
  const phase = useRaceStore((s) => s.phase)
  const speedRef = useRef<HTMLSpanElement>(null)
  const gearRef = useRef<HTMLSpanElement>(null)
  const arcRef = useRef<SVGCircleElement>(null)
  const fuelRef = useRef<HTMLDivElement>(null)
  const lapRef = useRef<HTMLSpanElement>(null)
  const driftPopupRef = useRef<HTMLSpanElement>(null)
  const lightRefs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    let lastDriftScore = 0
    let popupTimer: number | null = null
    return useCarStore.subscribe((state) => {
      const kmh = state.v * 3.6
      if (speedRef.current) speedRef.current.textContent = kmh.toFixed(0)
      if (gearRef.current) {
        gearRef.current.textContent = state.reversing ? 'R' : state.v < 0.1 ? 'N' : String(state.gear + 1)
      }

      if (arcRef.current) {
        const frac = Math.max(0, Math.min(1, state.v / TOP_SPEED)) * ARC_FRACTION
        arcRef.current.style.strokeDasharray = `${frac * ARC_CIRC} ${ARC_CIRC}`
      }

      if (fuelRef.current) {
        const pct = Math.max(0, Math.min(1, state.fuel)) * 100
        fuelRef.current.style.width = `${pct}%`
        fuelRef.current.style.background = pct < 15 ? 'var(--color-flag-yellow)' : 'var(--color-hud-cyan)'
      }

      if (lapRef.current) lapRef.current.textContent = formatLap(state.lapElapsedMs)

      const rpmFrac = Math.max(0, Math.min(1, (state.rpm - IDLE_RPM) / (REDLINE_RPM - IDLE_RPM)))
      SHIFT_LIGHTS.forEach((light, i) => {
        const el = lightRefs.current[i]
        if (el) el.style.background = rpmFrac >= light.at ? light.color : 'var(--color-graphite)'
      })

      // Drift score popup: a brief "DRIFT +x" whenever the cumulative score
      // has climbed since the last frame, cleared on a short timer rather
      // than tied to `drifting` directly so the last gain stays readable for
      // a beat after the slide ends.
      const gained = state.driftScore - lastDriftScore
      lastDriftScore = state.driftScore
      if (gained > 1 && driftPopupRef.current) {
        driftPopupRef.current.textContent = `DRIFT +${Math.round(gained)}`
        driftPopupRef.current.style.opacity = '1'
        if (popupTimer !== null) window.clearTimeout(popupTimer)
        popupTimer = window.setTimeout(() => {
          if (driftPopupRef.current) driftPopupRef.current.style.opacity = '0'
        }, 700)
      }
    })
  }, [])

  // Hidden on the grid before lights out: nothing to read yet.
  if (phase === 'lights' || phase === 'launching') return null

  return (
    <div
      // Block G4: shrinks on a narrow viewport. A transform scale rather than
      // resizing every child individually, anchored at the corner it is
      // already pinned to so it shrinks in place instead of drifting.
      className="pointer-events-none fixed right-6 bottom-8 z-10 chamfer flex origin-bottom-right scale-75 flex-col items-center gap-2 p-4 sm:scale-100"
      style={{
        background: 'rgba(21, 21, 30, 0.55)',
        boxShadow: 'inset 0 0 0 1px rgba(0,224,255,0.14), 0 0 18px rgba(0,0,0,0.35)',
      }}
    >
      {/* Drift score popup: absolutely positioned so it never shoves the
          gauges around when it appears. Opacity-driven, never mounted or
          unmounted, so there is nothing to layout-thrash at 60fps. */}
      <span
        ref={driftPopupRef}
        className="tabular pointer-events-none absolute -top-8 right-0 font-mono text-sm font-bold text-race-red uppercase opacity-0 transition-opacity duration-200"
      >
        DRIFT +0
      </span>

      <div className="flex items-baseline gap-1.5 font-mono text-[10px] tracking-widest text-smoke uppercase">
        Lap
        <span ref={lapRef} className="tabular text-sm font-bold text-paper normal-case">
          0:00.000
        </span>
      </div>

      <div className="flex gap-1.5">
        {SHIFT_LIGHTS.map((_, i) => (
          <span
            key={i}
            ref={(el) => {
              lightRefs.current[i] = el
            }}
            className="h-1.5 w-4 rounded-[1px]"
            style={{ background: 'var(--color-graphite)' }}
          />
        ))}
      </div>

      <div className="relative h-[104px] w-[104px]">
        <svg viewBox="0 0 104 104" className="h-full w-full -rotate-[225deg]">
          <circle
            cx={52}
            cy={52}
            r={ARC_RADIUS}
            fill="none"
            stroke="var(--color-slate)"
            strokeWidth={5}
            strokeDasharray={`${ARC_FRACTION * ARC_CIRC} ${ARC_CIRC}`}
            strokeLinecap="round"
          />
          <circle
            ref={arcRef}
            cx={52}
            cy={52}
            r={ARC_RADIUS}
            fill="none"
            stroke="var(--color-hud-cyan)"
            strokeWidth={5}
            strokeDasharray={`0 ${ARC_CIRC}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span ref={speedRef} className="tabular font-mono text-3xl font-bold text-paper">
            0
          </span>
          <span className="font-mono text-[9px] tracking-widest text-smoke uppercase">km/h</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-widest text-smoke uppercase">Gear</span>
        <span ref={gearRef} className="tabular font-mono text-xl font-bold text-paper">
          N
        </span>
        <span className="font-mono text-[9px] text-slate">/ {GEAR_COUNT}</span>
      </div>

      <div className="h-1.5 w-32 overflow-hidden rounded-[1px] bg-graphite">
        <div ref={fuelRef} className="h-full w-0" style={{ background: 'var(--color-hud-cyan)' }} />
      </div>
    </div>
  )
}
