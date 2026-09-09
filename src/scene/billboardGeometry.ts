import * as THREE from 'three'

export interface BillboardSpec {
  x: number
  y: number
  z: number
  width: number
  height: number
  uv: { u0: number; u1: number; v0: number; v1: number }
  /** DoubleSide means the same UVs paint both faces, so one side of any
   * quad always reads mirrored. Set true for boards viewed by looking in
   * -X (the opposite convention from the default, viewed looking +X). */
  flip?: boolean
  /**
   * 'x' (default): quad lies in the YZ plane, width runs along Z. Trackside
   * boards, read correctly from the -X side looking toward +X.
   * 'z': quad lies in the XY plane, width runs along X. Overhead gantry
   * panels, read by a car approaching from -Z. Because screen-right is -X
   * when looking down +Z, U is laid out along decreasing X.
   */
  facing?: 'x' | 'z'
}

/**
 * Merges many vertical quads (facing +/-X) into one BufferGeometry with each
 * quad's atlas cell baked into its own UVs. InstancedMesh shares a single UV
 * set across all instances, so per-board atlas cells are impossible there
 * without a custom shader; a merged geometry sidesteps that for one draw call.
 * Material should be DoubleSide since winding isn't tracked per quad here.
 */
export function buildBillboardGeometry(specs: BillboardSpec[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  specs.forEach((spec, i) => {
    const hw = spec.width / 2
    const hh = spec.height / 2

    if (spec.facing === 'z') {
      // Quad in the world XY plane, wound so U runs along decreasing X.
      positions.push(
        spec.x + hw, spec.y - hh, spec.z,
        spec.x - hw, spec.y - hh, spec.z,
        spec.x - hw, spec.y + hh, spec.z,
        spec.x + hw, spec.y + hh, spec.z,
      )
      for (let v = 0; v < 4; v++) normals.push(0, 0, -1)
    } else {
      // Quad in the world YZ plane: Z spans width, Y spans height.
      positions.push(
        spec.x, spec.y - hh, spec.z - hw,
        spec.x, spec.y - hh, spec.z + hw,
        spec.x, spec.y + hh, spec.z + hw,
        spec.x, spec.y + hh, spec.z - hw,
      )
      for (let v = 0; v < 4; v++) normals.push(1, 0, 0)
    }

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
  return geometry
}
