import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BARRIER_X, TRACK_LENGTH } from './trackLayout'

// Positive X reads as the driver's left in the forward-facing chase cam
// (verified visually), matching the spec's "Left Side" placement.
const POST_X = BARRIER_X + 2
const SPACING = 300
const BOOTH_SIZE = 0.8

function withColor(geometry: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const count = geometry.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3)
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

/** Booth + flat orange panel, baked as vertex colours so both merge into one draw call. */
function buildMarshalGeometry(): THREE.BufferGeometry {
  const booth = new THREE.BoxGeometry(BOOTH_SIZE, BOOTH_SIZE, BOOTH_SIZE)
  booth.translate(0, BOOTH_SIZE / 2, 0)
  withColor(booth, new THREE.Color('#3a3a42'))

  const panel = new THREE.PlaneGeometry(BOOTH_SIZE * 0.8, BOOTH_SIZE * 0.5)
  panel.rotateY(Math.PI / 2)
  panel.translate(BOOTH_SIZE / 2 + 0.01, BOOTH_SIZE * 0.55, 0)
  withColor(panel, new THREE.Color('#ff7a1a'))

  return mergeGeometries([booth, panel])
}

/** Small booth, orange flag panel is colour not emissive. Left side, occasional. */
export function MarshalPosts() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(buildMarshalGeometry, [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    [],
  )

  const zPositions = useMemo(() => {
    const arr: number[] = []
    for (let z = SPACING / 2; z < TRACK_LENGTH; z += SPACING) arr.push(z)
    return arr
  }, [])

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    zPositions.forEach((z, i) => {
      dummy.position.set(POST_X, 0, z)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [zPositions])

  return <instancedMesh ref={ref} args={[geometry, material, zPositions.length]} raycast={() => null} />
}
