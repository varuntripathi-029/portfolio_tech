import * as THREE from 'three'
import { TRACK_LENGTH, frameAt } from '../track/trackFrame'

/**
 * Sweeps a flat strip along the circuit between two lateral offsets.
 *
 * One of these per surface band replaces v1's one-long-plane-per-band. A plane
 * is useless on a curve, but the reason for separate meshes per band is
 * unchanged: blending four surfaces in one material costs four texture samples
 * on every ground fragment, and the ground fills most of the screen, so
 * separate meshes at about nine extra draw calls is far cheaper on integrated
 * GPUs.
 */
export interface RibbonSpec {
  /** Lateral offset of the left edge. */
  from: number
  /** Lateral offset of the right edge. */
  to: number
  /** Height above y=0, distinct per band so shared edges do not z-fight. */
  y: number
  /** Metres of world space covered by one texture tile. */
  tile: number
  /** Ring spacing along the track. */
  step?: number
}

/**
 * Texture tiling has to close at the start/finish line.
 *
 * V runs as s / tile, so the wrap only lines up if L / tile is a whole number.
 * The requested tile is nudged to the nearest value that divides the lap
 * exactly, which moves it by at most half a percent and removes a seam across
 * the full track width at the one place every reader looks twice.
 */
export function seamlessTile(tile: number): number {
  return TRACK_LENGTH / Math.max(1, Math.round(TRACK_LENGTH / tile))
}

export function buildRibbon(spec: RibbonSpec): THREE.BufferGeometry {
  const step = spec.step ?? 3
  const tile = seamlessTile(spec.tile)
  const rings = Math.max(3, Math.round(TRACK_LENGTH / step))
  const ds = TRACK_LENGTH / rings

  // rings + 1: the last ring repeats the first position but carries the
  // wrapped V, so the texture meets itself instead of jumping.
  const count = rings + 1
  const positions = new Float32Array(count * 2 * 3)
  const normals = new Float32Array(count * 2 * 3)
  const uvs = new Float32Array(count * 2 * 2)
  const indices: number[] = []

  const fr = { x: 0, z: 0, tx: 0, tz: 0, lx: 0, lz: 0, curvature: 0 }

  for (let i = 0; i < count; i++) {
    const s = i * ds
    frameAt(s, fr)
    const v = s / tile

    for (let side = 0; side < 2; side++) {
      const d = side === 0 ? spec.from : spec.to
      const o = (i * 2 + side) * 3
      positions[o] = fr.x + fr.lx * d
      positions[o + 1] = spec.y
      positions[o + 2] = fr.z + fr.lz * d
      normals[o] = 0
      normals[o + 1] = 1
      normals[o + 2] = 0
      const u = (i * 2 + side) * 2
      uvs[u] = d / tile
      uvs[u + 1] = v
    }

    if (i < count - 1) {
      const a = i * 2
      const b = i * 2 + 1
      const c = (i + 1) * 2
      const e = (i + 1) * 2 + 1
      indices.push(a, c, b, b, c, e)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}
