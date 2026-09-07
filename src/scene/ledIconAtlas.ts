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

export const ATLAS_COLS = 6
export const ATLAS_ROWS = 3
export const ICON_COUNT = ICONS.length

const ATLAS_SIZE = 1024
const BOARD_BACKING = '#14141a'

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

export function makeLedAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_SIZE
  canvas.height = ATLAS_SIZE
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = BOARD_BACKING
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)

  const cellW = ATLAS_SIZE / ATLAS_COLS
  const cellH = ATLAS_SIZE / ATLAS_ROWS
  const iconSize = Math.min(cellW, cellH) * 0.6

  ICONS.forEach((icon, i) => {
    if (!icon) return
    const col = i % ATLAS_COLS
    const row = Math.floor(i / ATLAS_COLS)
    const cellX = col * cellW
    const cellY = row * cellH

    ctx.save()
    ctx.translate(cellX + cellW / 2 - iconSize / 2, cellY + cellH / 2 - iconSize / 2)
    ctx.scale(iconSize / 24, iconSize / 24)
    ctx.fillStyle = boardColor(icon.hex)
    ctx.fill(new Path2D(icon.path))
    ctx.restore()
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** UV rect for atlas cell `index`, wrapping if there are more boards than icons. */
export function ledCellUV(index: number) {
  const i = index % ICON_COUNT
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
