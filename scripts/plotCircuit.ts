/**
 * Writes circuit.svg, a top-down plan of the circuit.
 *
 * This is how the layout gets checked without a frame loop. The minimap in
 * Stage 3 reuses the same centreline data.
 *
 *   npx tsx scripts/plotCircuit.ts
 */

import { writeFileSync } from 'node:fs'
import {
  RESOLVED,
  FLAT_RADIUS,
  MAIN_STRAIGHT_LENGTH,
  DESIGN_LENGTH,
} from '../src/track/circuit'
import { TRACK_LENGTH, OUTSIDE_SIGN, frameAt, positionAt } from '../src/track/trackFrame'
import { BANDS, BARRIER_X } from '../src/scene/trackLayout'
import { SECTIONS } from '../src/data/sections'
import {
  assertCircuit,
  assertPropClearance,
  assertPropsOutside,
  measureCorners,
  measureOutsideViolations,
  measurePropClearance,
  measureSeparation,
} from '../src/track/assertions'
import { collectProps, collectOutsideProps } from '../src/track/props'

const PAD = 90
const OUT = 'circuit.svg'

/**
 * Escapes text going into an SVG <text> node.
 *
 * Every string interpolated into a text node here was written unescaped, so
 * the legend's own "d<0" label broke the file at a literal `<` and every
 * browser stopped rendering right there: everything after that point in the
 * document (all of BLOCK A's corner labels, section markers and stops) was
 * silently dropped. `&`, `<` and `>` all need escaping in a text node; `"`
 * only matters inside an attribute, which the text nodes here never are.
 */
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function ring(d: number, step = 4) {
  const pts: string[] = []
  for (let s = 0; s <= TRACK_LENGTH; s += step) {
    const p = positionAt(s, d)
    pts.push(`${p.x.toFixed(1)},${p.z.toFixed(1)}`)
  }
  return pts.join(' ')
}

/**
 * SKIP_CHECKS=1 plots the layout even when it violates a constraint, which is
 * the only way to see WHY a geometry assertion fired.
 */
const skip = process.env.SKIP_CHECKS === '1'
let checks: ReturnType<typeof assertCircuit> = {
  radii: [],
  gaps: [],
  separation: NaN,
}
let clearance = NaN
const props = collectProps()
const outsideProps = collectOutsideProps()
let outsideViolations: ReturnType<typeof measureOutsideViolations> = []
const failures: string[] = []
if (skip) {
  try {
    checks = assertCircuit()
  } catch (e) {
    failures.push(String((e as Error).message))
    checks.radii = measureCorners()
    checks.separation = measureSeparation().distance
  }
  try {
    clearance = assertPropClearance(props)
  } catch (e) {
    failures.push(String((e as Error).message))
    clearance = measurePropClearance(props).distance
  }
  try {
    assertPropsOutside(outsideProps)
  } catch (e) {
    failures.push(String((e as Error).message))
    outsideViolations = measureOutsideViolations(outsideProps)
  }
} else {
  checks = assertCircuit()
  clearance = assertPropClearance(props)
  assertPropsOutside(outsideProps)
}

// Bounds from the outermost ring plus the props.
let minX = Infinity
let maxX = -Infinity
let minZ = Infinity
let maxZ = -Infinity
for (let s = 0; s <= TRACK_LENGTH; s += 2) {
  for (const d of [-BARRIER_X, BARRIER_X]) {
    const p = positionAt(s, d)
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
}
for (const p of props) {
  minX = Math.min(minX, p.x)
  maxX = Math.max(maxX, p.x)
  minZ = Math.min(minZ, p.z)
  maxZ = Math.max(maxZ, p.z)
}

const w = maxX - minX + PAD * 2
const h = maxZ - minZ + PAD * 2

const parts: string[] = []
parts.push(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(minX - PAD).toFixed(0)} ${(minZ - PAD).toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" width="1400">`,
)
// Z grows "up" in world space but down in SVG, so flip once around the
// viewBox centre. Without this the plan is mirrored against the minimap.
const cz = minZ - PAD + h / 2
parts.push(`<g transform="translate(0 ${(2 * cz).toFixed(2)}) scale(1 -1)">`)
parts.push(`<rect x="${(minX - PAD).toFixed(0)}" y="${(minZ - PAD).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#15151e"/>`)

// Surface bands, outermost first so inner ones draw over.
const bandFill: Record<string, string> = {
  grass: '#2b3a26',
  gravel: '#4a4034',
  runoff: '#3a3a3f',
  kerb: '#7a2222',
  track: '#232329',
}
for (const band of [...BANDS].reverse()) {
  for (const sign of [1, -1]) {
    if (band.inner === 0 && sign === -1) continue
    const outer = band.inner === 0 ? band.outer : band.outer
    const inner = band.inner === 0 ? -band.outer : band.inner
    parts.push(
      `<polygon points="${ring(sign * outer)} ${ring(sign * inner, 4).split(' ').reverse().join(' ')}" fill="${bandFill[band.id]}" />`,
    )
  }
}

// Centreline.
parts.push(`<polyline points="${ring(0, 2)}" fill="none" stroke="#5a5a64" stroke-width="1" stroke-dasharray="8 8"/>`)

// Lift corners, highlighted with their measured radius.
for (const seg of RESOLVED) {
  if (seg.kind !== 'arc') continue
  const measured = checks.radii.find((r) => r.id === seg.id)
  if (!measured) continue
  const pts: string[] = []
  for (let s = seg.start; s <= seg.start + seg.length; s += 2) {
    const p = positionAt(s * (TRACK_LENGTH / DESIGN_LENGTH), 0)
    pts.push(`${p.x.toFixed(1)},${p.z.toFixed(1)}`)
  }
  const colour = seg.lift ? '#ffd500' : '#00e0ff'
  const width = seg.lift ? 5 : 2
  parts.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${colour}" stroke-width="${width}" opacity="${seg.lift ? 0.95 : 0.4}"/>`)
  const mid = positionAt((seg.start + seg.length / 2) * (TRACK_LENGTH / DESIGN_LENGTH), OUTSIDE_SIGN * 34)
  parts.push(
    `<g transform="translate(${mid.x.toFixed(1)} ${mid.z.toFixed(1)}) scale(1 -1)">` +
      `<text x="0" y="0" fill="${colour}" font-family="monospace" font-size="13" text-anchor="middle">` +
      `${esc(seg.id + ' R' + measured.measuredRadius.toFixed(0) + (seg.lift ? ' LIFT' : ''))}</text></g>`,
  )
}

// Props.
for (const p of props) {
  parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.z.toFixed(1)}" r="2.2" fill="#8a8a94" opacity="0.75"/>`)
}
// Outside-only props that failed the winding-number check, drawn large and
// red so a failure is legible on the plot, not just in the console.
for (const p of outsideViolations) {
  parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.z.toFixed(1)}" r="6" fill="none" stroke="#e10600" stroke-width="2"/>`)
}

// Start/finish line across the full track width.
{
  const a = positionAt(0, -BARRIER_X)
  const b = positionAt(0, BARRIER_X)
  parts.push(`<line x1="${a.x.toFixed(1)}" y1="${a.z.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.z.toFixed(1)}" stroke="#f7f4f1" stroke-width="4"/>`)
}

// Section stops.
SECTIONS.forEach((sec, i) => {
  const p = positionAt(sec.s, 0)
  const label = positionAt(sec.s, OUTSIDE_SIGN * 26)
  const colour = sec.kind === 'contact' ? '#e10600' : sec.kind === 'grid' ? '#f7f4f1' : '#00d26a'
  const across = [positionAt(sec.s, -6), positionAt(sec.s, 6)]
  parts.push(
    `<line x1="${across[0].x.toFixed(1)}" y1="${across[0].z.toFixed(1)}" x2="${across[1].x.toFixed(1)}" y2="${across[1].z.toFixed(1)}" stroke="${colour}" stroke-width="3"/>`,
  )
  parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.z.toFixed(1)}" r="6" fill="${colour}"/>`)
  parts.push(
    `<g transform="translate(${label.x.toFixed(1)} ${label.z.toFixed(1)}) scale(1 -1)">` +
      `<text x="0" y="5" fill="${colour}" font-family="monospace" font-size="17" font-weight="bold" text-anchor="middle">` +
      `${esc(i + '. ' + sec.label.toUpperCase())}</text>` +
      `<text x="0" y="21" fill="${colour}" font-family="monospace" font-size="12" text-anchor="middle" opacity="0.8">` +
      `${esc('s=' + sec.s.toFixed(0) + 'm')}</text></g>`,
  )
})

// Direction arrows along the racing line.
for (let s = 60; s < TRACK_LENGTH; s += 220) {
  const fr = frameAt(s)
  const deg = (Math.atan2(fr.tz, fr.tx) * 180) / Math.PI
  parts.push(
    `<g transform="translate(${fr.x.toFixed(1)} ${fr.z.toFixed(1)}) rotate(${deg.toFixed(1)})">` +
      `<polygon points="0,0 -11,4 -11,-4" fill="#e10600" opacity="0.9"/></g>`,
  )
}

parts.push('</g>')

// Legend, in screen space so it is not flipped.
const lines = [
  `length ${TRACK_LENGTH.toFixed(0)}m   design ${DESIGN_LENGTH.toFixed(0)}m   flat-out radius ${FLAT_RADIUS.toFixed(0)}m`,
  `main straight ${MAIN_STRAIGHT_LENGTH.toFixed(0)}m   ` +
    RESOLVED.filter((r) => r.kind === 'straight')
      .map((r) => `${r.id} ${r.length.toFixed(0)}`)
      .join('  '),
  `min non-adjacent separation ${checks.separation.toFixed(1)}m   min prop clearance ${clearance.toFixed(1)}m`,
  `stop gaps ${checks.gaps.map((g) => g.toFixed(0)).join(' / ')}m   outside is d${OUTSIDE_SIGN > 0 ? '>0' : '<0'}`,
  `props plotted ${props.length}`,
  ...failures.map((f) => `FAIL ${f}`),
]
lines.forEach((line, i) => {
  const fill = line.startsWith('FAIL') ? '#e10600' : '#949498'
  parts.push(
    `<text x="${(minX - PAD + 14).toFixed(0)}" y="${(minZ - PAD + 24 + i * 19).toFixed(0)}" fill="${fill}" font-family="monospace" font-size="14">${esc(line.slice(0, 150))}</text>`,
  )
})
parts.push('</svg>')

writeFileSync(OUT, parts.join('\n'))

console.log(`wrote ${OUT}`)
console.log(`  length            ${TRACK_LENGTH.toFixed(1)}m (design ${DESIGN_LENGTH.toFixed(1)}m)`)
console.log(`  main straight     ${MAIN_STRAIGHT_LENGTH.toFixed(1)}m`)
for (const seg of RESOLVED.filter((r) => r.kind === 'straight')) {
  console.log(`    ${seg.id.padEnd(22)} ${seg.length.toFixed(1).padStart(7)}m`)
}
console.log(`  outside sign      d${OUTSIDE_SIGN > 0 ? ' > 0' : ' < 0'}`)
console.log(`  separation        ${checks.separation.toFixed(1)}m (min ${60})`)
console.log(`  prop clearance    ${clearance.toFixed(1)}m (min ${20}), ${props.length} props`)
console.log(`  stop gaps         ${checks.gaps.map((g) => g.toFixed(0) + 'm').join(', ')}`)
console.log('  corners:')
for (const r of checks.radii) {
  console.log(
    `    ${r.id.padEnd(22)} design R${String(r.designRadius).padStart(4)}  measured R${r.measuredRadius.toFixed(0).padStart(4)}${r.lift ? '   LIFT' : ''}`,
  )
}
for (const f of failures) console.log(`  FAIL ${f}`)
console.log('  stops:')
for (const sec of SECTIONS) {
  console.log(`    ${sec.id.padEnd(14)} s=${sec.s.toFixed(1).padStart(8)}m  ${sec.kind}`)
}
