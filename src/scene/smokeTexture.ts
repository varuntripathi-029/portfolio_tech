import * as THREE from 'three'

/**
 * One procedural soft dot, drawn to a canvas once at boot: the tyre-smoke
 * particle sprite and the spark/dust texture spec 1.7 describes as
 * "a single procedurally drawn 128 soft dot on a canvas, additive-blended
 * points system", reused here for the same reason it exists there: no
 * downloaded asset, no image decode.
 */
export function makeSoftDotTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.35)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
