import * as THREE from 'three'

/**
 * Staggered starting-grid boxes, transparent background so the asphalt
 * grain underneath still reads. Plane U maps to world X, V maps to world Z
 * (see RoadMarkings for the geometry/rotation this pairs with).
 */
export function makeStartingGridTexture(trackWidth: number, gridLength: number): THREE.CanvasTexture {
  const W = 256
  const H = 1024
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.strokeStyle = '#f2f2f0'
  ctx.lineWidth = 5

  const boxWidth = 2.5
  const boxLength = 3
  const pxPerX = W / trackWidth
  const pxPerZ = H / gridLength

  // Two-by-two stagger: pole on one side, row behind offset to the other.
  const rows = 4
  const rowSpacing = gridLength / (rows + 0.5)
  for (let row = 0; row < rows; row++) {
    const z = rowSpacing * (row + 0.7)
    const side = row % 2 === 0 ? -1 : 1
    for (const laneSide of [side, -side]) {
      const x = laneSide * 1.6
      const px = (x - boxWidth / 2 + trackWidth / 2) * pxPerX
      const py = (z - boxLength / 2) * pxPerZ
      ctx.strokeRect(px, py, boxWidth * pxPerX, boxLength * pxPerZ)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
