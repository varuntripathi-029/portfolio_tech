import * as THREE from 'three'
import {
  siReact,
  siTypescript,
  siPython,
  siFastapi,
  siPostgresql,
  siRedis,
  siDocker,
  siNextdotjs,
  siTailwindcss,
  siVite,
  siGit,
  siGithub,
  siLinux,
  siHuggingface,
  siVercel,
  siThreedotjs,
  siSpring,
  siPandas,
} from 'simple-icons'

// All 18 exist in simple-icons@15; kept as a runtime filter anyway so a
// future package bump that drops one degrades instead of failing to build.
const ALL_ICONS = [
  siReact,
  siTypescript,
  siPython,
  siFastapi,
  siPostgresql,
  siRedis,
  siDocker,
  siNextdotjs,
  siTailwindcss,
  siVite,
  siGit,
  siGithub,
  siLinux,
  siHuggingface,
  siVercel,
  siThreedotjs,
  siSpring,
  siPandas,
]
const ICONS = ALL_ICONS.filter((icon): icon is NonNullable<typeof icon> => Boolean(icon))

/**
 * Cell aspect must match the board quad's aspect or the icon shears. A 6x3
 * grid gave cells of 1:2 (tall) which, mapped onto an 8x2 board, stretched
 * every logo 8x across. 2 cols x 9 rows gives 512 x 113.8 cells, exactly 4.5:1.
 *
 * BOARD_ASPECT is the contract: LedBoards and GantryBridges size their quads
 * from it, so the two can never drift apart again.
 */
export const ATLAS_COLS = 2
export const ATLAS_ROWS = 9
export const ICON_COUNT = ICONS.length

const ATLAS_SIZE = 1024
const CELL_W = ATLAS_SIZE / ATLAS_COLS
const CELL_H = ATLAS_SIZE / ATLAS_ROWS
export const BOARD_ASPECT = CELL_W / CELL_H

const BOARD_BACKING = '#14141a'
const TEXT_FONT = '"Titillium Web", system-ui, sans-serif'

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Boards are opaque and high-contrast, never emissive, so near-black brand
 * hexes (Next.js, Vercel, three.js are all #000) need a light substitute or
 * they vanish into the dark backing. */
function boardColor(hex: string): string {
  return relativeLuminance(hex) < 0.25 ? '#e5e5e5' : `#${hex}`
}

/**
 * A wide board carrying one small square glyph reads as a mistake. Real
 * trackside advertising is a mark plus a wordmark filling the panel, which is
 * also what makes these legible from a chase cam.
 */
function paint(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BOARD_BACKING
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)

  const pad = CELL_H * 0.2
  const glyph = CELL_H * 0.56
  const gap = CELL_H * 0.22

  ICONS.forEach((icon, i) => {
    const cellX = (i % ATLAS_COLS) * CELL_W
    const cellY = Math.floor(i / ATLAS_COLS) * CELL_H
    const color = boardColor(icon.hex)

    ctx.save()
    ctx.translate(cellX + pad, cellY + (CELL_H - glyph) / 2)
    ctx.scale(glyph / 24, glyph / 24) // simple-icons paths use a 24x24 viewBox
    ctx.fillStyle = color
    ctx.fill(new Path2D(icon.path))
    ctx.restore()

    const textX = cellX + pad + glyph + gap
    const available = CELL_W - (textX - cellX) - pad
    const label = icon.title.toUpperCase()

    // Shrink to fit rather than overflow into the neighbouring cell.
    let size = CELL_H * 0.42
    ctx.font = `700 ${size}px ${TEXT_FONT}`
    const measured = ctx.measureText(label).width
    if (measured > available) {
      size *= available / measured
      ctx.font = `700 ${size}px ${TEXT_FONT}`
    }

    ctx.fillStyle = color
    ctx.textBaseline = 'middle'
    ctx.fillText(label, textX, cellY + CELL_H / 2 + size * 0.04)
  })
}

export function makeLedAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_SIZE
  canvas.height = ATLAS_SIZE
  const ctx = canvas.getContext('2d')!

  paint(ctx)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  // The webfont is very likely still loading at boot, so the first paint would
  // land in a fallback face. Repaint once it is ready; the texture object is
  // unchanged, so nothing downstream needs to know.
  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.ready.then(() => {
      paint(ctx)
      texture.needsUpdate = true
    })
  }

  return texture
}

/** UV rect for atlas cell `index`, wrapping if there are more boards than icons. */
export function ledCellUV(index: number) {
  const i = ((index % ICON_COUNT) + ICON_COUNT) % ICON_COUNT
  const col = i % ATLAS_COLS
  const row = Math.floor(i / ATLAS_COLS)
  return {
    u0: col / ATLAS_COLS,
    u1: (col + 1) / ATLAS_COLS,
    // Canvas Y grows down, texture V grows up.
    v0: 1 - (row + 1) / ATLAS_ROWS,
    v1: 1 - row / ATLAS_ROWS,
  }
}
