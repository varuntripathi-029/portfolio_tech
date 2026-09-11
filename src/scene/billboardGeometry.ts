import * as THREE from 'three'

export interface BillboardSpec {
  /** Centre of the quad, in world space. */
  x: number
  y: number
  z: number
  width: number
  height: number
  uv: { u0: number; u1: number; v0: number; v1: number }
  /**
   * DoubleSide means the same UVs paint both faces, so one side of any quad
   * always reads mirrored. Set true when the board is read from the face
   * pointing along -`right` rather than +.
   */
  flip?: boolean
  /**
   * Which way the quad faces, as a horizontal unit vector. Width runs along
   * `right`, height runs along world Y.
   *
   * REPLACES v1's `facing: 'x' | 'z'` axis modes, which only worked while the
   * track ran dead straight along +Z. On a curve a trackside board has to face
   * -left (in toward the track) and a gantry panel has to face -tangent
   * (back at an approaching car), and neither is axis aligned.
   */
  right: { x: number; z: number }
}

/**
 * Merges many vertical quads into one BufferGeometry with each quad's atlas
 * cell baked into its own UVs.
 *
 * InstancedMesh shares a single UV set across all instances, so per-board atlas
 * cells are impossible there without a custom shader; a merged geometry
 * sidesteps that for one draw call. Material should be DoubleSide, since
 * winding is not tracked per quad here.
 */
export function buildBillboardGeometry(specs: BillboardSpec[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  specs.forEach((spec, i) => {
    const hh = spec.height / 2
    const len = Math.hypot(spec.right.x, spec.right.z) || 1
    const rx = (spec.right.x / len) * (spec.width / 2)
    const rz = (spec.right.z / len) * (spec.width / 2)
    // Facing is `right` rotated 90 degrees, which for a quad spanning `right`
    // and world Y is its surface normal.
    const nx = -spec.right.z / len
    const nz = spec.right.x / len

    positions.push(
      spec.x - rx, spec.y - hh, spec.z - rz,
      spec.x + rx, spec.y - hh, spec.z + rz,
      spec.x + rx, spec.y + hh, spec.z + rz,
      spec.x - rx, spec.y + hh, spec.z - rz,
    )
    for (let v = 0; v < 4; v++) normals.push(nx, 0, nz)

    const { u0, u1, v0, v1 } = spec.uv
    if (spec.flip) uvs.push(u1, v0, u0, v0, u0, v1, u1, v1)
    else uvs.push(u0, v0, u1, v0, u1, v1, u0, v1)

    const base = i * 4
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}
