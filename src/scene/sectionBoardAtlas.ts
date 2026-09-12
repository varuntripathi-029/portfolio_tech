import * as THREE from 'three'
import { SECTIONS } from '../data/sections'

/**
 * One small canvas atlas carrying every non-grid section's name, read by an
 * approaching car on the straight before its braking zone (real F1 corner
 * boards, adapted to a section stop instead of a corner number). Same
 * merged-geometry-plus-atlas-UV approach as `ledIconAtlas.ts`, scaled down to
 * 4 cells instead of 18 since there are only 4 non-grid sections.
 */

// 2 cols x 2 rows keeps cells square-ish for a name-only board, unlike the
// LED atlas's wide mark-plus-wordmark cells.
export const BOARD_COLS = 2
export const BOARD_ROWS = 2

const ATLAS_SIZE = 512
const CELL_W = ATLAS_SIZE / BOARD_COLS
const CELL_H = ATLAS_SIZE / BOARD_ROWS
export const SECTION_BOARD_ASPECT = CELL_W / CELL_H

const BACKING = '#14141a'
const TEXT_FONT = '"Titillium Web", system-ui, sans-serif'

// Only the 4 non-grid sections get a board: DRIVER is the grid, not a
// braking stop a car approaches mid-lap in the same sense.
export const BOARD_SECTIONS = SECTIONS.filter((s) => s.kind !== 'grid')

function paint(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BACKING
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)

  BOARD_SECTIONS.forEach((section, i) => {
    const cellX = (i % BOARD_COLS) * CELL_W
    const cellY = Math.floor(i / BOARD_COLS) * CELL_H

    // The one red rule, same graphic language as the DOM Panel header.
    ctx.fillStyle = '#e10600'
    ctx.fillRect(cellX + CELL_W * 0.1, cellY + CELL_H * 0.66, CELL_W * 0.8, CELL_H * 0.04)

    const label = section.label.toUpperCase()
    let size = CELL_H * 0.26
    ctx.font = `900 ${size}px ${TEXT_FONT}`
    const available = CELL_W * 0.82
    const measured = ctx.measureText(label).width
    if (measured > available) {
      size *= available / measured
      ctx.font = `900 ${size}px ${TEXT_FONT}`
    }
    ctx.fillStyle = '#f7f4f1'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, cellX + CELL_W / 2, cellY + CELL_H * 0.46)
  })
}

export function makeSectionBoardAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_SIZE
  canvas.height = ATLAS_SIZE
  const ctx = canvas.getContext('2d')!

  paint(ctx)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  // Same webfont-not-ready trap as the LED atlas: force the exact weight
  // this paints with, then repaint once it actually lands.
  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts
      .load(`900 32px "Titillium Web"`)
      .then(() => {
        paint(ctx)
        texture.needsUpdate = true
      })
      .catch(() => {
        /* fallback face already painted; nothing to recover */
      })
  }

  return texture
}

export function sectionBoardUV(index: number) {
  const col = index % BOARD_COLS
  const row = Math.floor(index / BOARD_COLS)
  return {
    u0: col / BOARD_COLS,
    u1: (col + 1) / BOARD_COLS,
    v0: 1 - (row + 1) / BOARD_ROWS,
    v1: 1 - row / BOARD_ROWS,
  }
}
