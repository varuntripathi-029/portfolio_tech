import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MARSHAL_POSTS } from '../track/props'
import { frameAt } from '../track/trackFrame'

const BOOTH_SIZE = 0.8

/**
 * Bakes a flat colour into a geometry as vertex colours, so the booth and its
 * orange panel merge into one draw call.
 *
 * This is the one legitimate use of `vertexColors: true` in the project, because
 * the attribute really exists here. It must never coexist with `setColorAt` on
 * the same mesh: three multiplies the vertex colour in before the instance
 * colour, which would zero every instance to black.
 */
function withColor(geometry: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const count = geometry.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3)
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

function buildMarshalGeometry(): THREE.BufferGeometry {
  const booth = new THREE.BoxGeometry(BOOTH_SIZE, BOOTH_SIZE, BOOTH_SIZE)
  booth.translate(0, BOOTH_SIZE / 2, 0)
  withColor(booth, new THREE.Color('#3a3a42'))

  const panel = new THREE.PlaneGeometry(BOOTH_SIZE * 0.8, BOOTH_SIZE * 0.5)
  // Posts sit outside the loop and are oriented to the tangent, so the panel
  // goes on the -left face to look back at the racing line.
  panel.rotateY(-Math.PI / 2)
  panel.translate(-BOOTH_SIZE / 2 - 0.01, BOOTH_SIZE * 0.55, 0)
  withColor(panel, new THREE.Color('#ff7a1a'))

  return mergeGeometries([booth, panel])
}

/** Small booth, orange flag panel as colour not emissive. Outside the loop. */
export function MarshalPosts() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(buildMarshalGeometry, [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    [],
  )

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    MARSHAL_POSTS.forEach((p, i) => {
      const fr = frameAt(p.s)
      dummy.position.set(fr.x + fr.lx * p.d, 0, fr.z + fr.lz * p.d)
      dummy.rotation.set(0, Math.atan2(fr.tx, fr.tz), 0)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, MARSHAL_POSTS.length]}
      raycast={() => null}
    />
  )
}
