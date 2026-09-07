import * as THREE from 'three'

/**
 * Red/white kerb stripes drawn to a canvas, no image file. One tile is one
 * red block and one white block; RepeatWrapping tiles it along the track.
 */
export function makeKerbTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#f2f2f0'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#d21c1c'
  ctx.fillRect(0, 0, size, size / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
