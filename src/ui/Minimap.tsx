import { useEffect, useMemo, useRef } from 'react'
import { useCarStore } from '../state/carStore'
import { useRaceStore } from '../state/raceStore'
import { SECTIONS } from '../data/sections'
import { TRACK_LENGTH, OUTSIDE_SIGN, centreline, frameAt } from '../track/trackFrame'

const PAD = 18
const SIZE = 168

/**
 * Circular, north-up, drawn from the SAME `centreline()` data
 * `scripts/plotCircuit.ts` reads. One source of truth for the track shape: a
 * hand-drawn minimap path would drift from the geometry the moment a control
 * point moved.
 */
export function Minimap() {
  const svgRef = useRef<SVGSVGElement>(null)
  const completedRef = useRef<SVGPolylineElement>(null)
  const carRef = useRef<SVGGElement>(null)

  const { points, viewBox, project } = useMemo(() => {
    const raw = centreline(6)
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const p of raw) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minZ = Math.min(minZ, p.z)
      maxZ = Math.max(maxZ, p.z)
    }
    const w = maxX - minX
    const h = maxZ - minZ
    const scale = (SIZE - PAD * 2) / Math.max(w, h)
    const ox = (SIZE - w * scale) / 2 - minX * scale
    // Z grows "up" in world space but SVG Y grows down, and north-up means
    // the loop must not additionally rotate with the car, so this flip is
    // the only transform: project(z) = SIZE - (flip of world z).
    const oz = (SIZE - h * scale) / 2 + maxZ * scale
    const proj = (x: number, z: number) => ({ x: x * scale + ox, y: oz - z * scale })
    return {
      points: raw.map((p) => proj(p.x, p.z)),
      viewBox: `0 0 ${SIZE} ${SIZE}`,
      project: proj,
    }
  }, [])

  const fullPath = useMemo(() => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), [points])

  useEffect(
    () =>
      useCarStore.subscribe((state) => {
        const completed = completedRef.current
        const car = carRef.current
        if (!completed || !car) return

        const frac = Math.max(0, Math.min(1, state.s / TRACK_LENGTH))
        const upto = Math.max(1, Math.round(frac * points.length))
        completed.setAttribute(
          'points',
          points
            .slice(0, upto)
            .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(' '),
        )

        const fr = frameAt(state.s)
        const pos = project(fr.x + fr.lx * state.d, fr.z + fr.lz * state.d)
        // Heading in SVG space: world tangent (tx, tz) maps through the same
        // flip as position, so screen angle = atan2(tx, -tz) (0 = up).
        const angleDeg = (Math.atan2(fr.tx, -fr.tz) * 180) / Math.PI
        car.setAttribute('transform', `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)}) rotate(${angleDeg.toFixed(1)})`)
      }),
    [points, project],
  )

  const warp = (id: (typeof SECTIONS)[number]['id']) => useRaceStore.getState().requestWarp({ section: id })
  const phase = useRaceStore((s) => s.phase)

  // Hidden alongside the Dashboard while the DRIVER card owns the same
  // top-left corner of the screen during the grid wait and the launch.
  if (phase === 'lights' || phase === 'launching') return null

  return (
    <div
      className="pointer-events-none fixed top-20 left-4 z-10 chamfer h-[130px] w-[130px] p-1.5 sm:top-24 sm:left-6 sm:h-[190px] sm:w-[190px] sm:p-2"
      style={{
        // Fake glass: translucent fill, inner edge highlight, soft glow, no
        // backdrop-filter. The HUD is on screen permanently, so a real blur
        // here would mean a second blurred surface whenever a card is also
        // open, breaking the one-blur rule.
        background: 'rgba(21, 21, 30, 0.55)',
        boxShadow: 'inset 0 0 0 1px rgba(247,244,241,0.12), 0 0 18px rgba(0,0,0,0.35)',
      }}
    >
      <svg ref={svgRef} viewBox={viewBox} className="h-full w-full overflow-visible">
        <polyline points={fullPath} fill="none" stroke="var(--color-slate)" strokeWidth={2.5} strokeLinejoin="round" />
        <polyline ref={completedRef} points="" fill="none" stroke="var(--color-race-red)" strokeWidth={2.5} strokeLinejoin="round" />

        {SECTIONS.map((sec, i) => {
          const fr = frameAt(sec.s)
          const at = project(fr.x, fr.z)
          const label = project(fr.x + fr.lx * OUTSIDE_SIGN * 30, fr.z + fr.lz * OUTSIDE_SIGN * 30)
          return (
            <g key={sec.id} className="pointer-events-auto cursor-pointer" onClick={() => warp(sec.id)}>
              <circle cx={at.x} cy={at.y} r={7} fill="transparent" />
              <circle cx={at.x} cy={at.y} r={3.2} fill="var(--color-paper)" stroke="var(--color-carbon)" strokeWidth={1} />
              <text
                x={label.x}
                y={label.y}
                fill="var(--color-smoke)"
                fontSize={7}
                fontFamily="monospace"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {i}
              </text>
            </g>
          )
        })}

        <g ref={carRef}>
          <polygon points="0,-6 4,5 -4,5" fill="var(--color-hud-cyan)" />
        </g>
      </svg>
    </div>
  )
}
