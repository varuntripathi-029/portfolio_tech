import * as THREE from 'three'

const YEARS = ['2023', '2024', '2025', '2026']
export const YEAR_COLS = 2
export const YEAR_ROWS = 2
export const YEAR_COUNT = YEARS.length

const ATLAS_SIZE = 512

export function makeYearAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_SIZE
  canvas.height = ATLAS_SIZE
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#14141a'
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)

  const cellW = ATLAS_SIZE / YEAR_COLS
  const cellH = ATLAS_SIZE / YEAR_ROWS

  ctx.fillStyle = '#f2f2f0'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${Math.floor(cellH * 0.3)}px sans-serif`

  YEARS.forEach((year, i) => {
    const col = i % YEAR_COLS
    const row = Math.floor(i / YEAR_COLS)
    ctx.fillText(year, col * cellW + cellW / 2, row * cellH + cellH / 2)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function yearCellUV(index: number) {
  const i = index % YEAR_COUNT
  const col = i % YEAR_COLS
  const row = Math.floor(i / YEAR_COLS)
  return {
    u0: col / YEAR_COLS,
    u1: (col + 1) / YEAR_COLS,
    v0: 1 - (row + 1) / YEAR_ROWS,
    v1: 1 - row / YEAR_ROWS,
  }
}
