import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BARRIER_X, TRACK_LENGTH } from './trackLayout'

// Positive X reads as the driver's left in the forward-facing chase cam
// (verified visually), matching the spec's "Left Side" placement.
const STAND_X = BARRIER_X + 20
const SPACING = 400
const BASE_WIDTH = 20
const BASE_DEPTH = 8
const STEPS = 4
const STEP_HEIGHT = 1.5

function buildGrandstandGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (let s = 0; s < STEPS; s++) {
    const width = BASE_WIDTH - s * 3
    const depth = BASE_DEPTH - s * 1.2
    const box = new THREE.BoxGeometry(width, STEP_HEIGHT, depth)
    box.translate(0, STEP_HEIGHT / 2 + s * STEP_HEIGHT, -s * 1.2)
    parts.push(box)
  }
  return mergeGeometries(parts)
}

/** Blocky stepped silhouettes, mid-tone, no seats or people, no glowing dots. */
export function Grandstands() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(buildGrandstandGeometry, [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#555a63', roughness: 1 }), [])

  const zPositions = useMemo(() => {
    const arr: number[] = []
    for (let z = SPACING / 2; z < TRACK_LENGTH; z += SPACING) arr.push(z)
    return arr
  }, [])

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    zPositions.forEach((z, i) => {
      dummy.position.set(STAND_X, 0, z)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [zPositions])

  return <instancedMesh ref={ref} args={[geometry, material, zPositions.length]} raycast={() => null} />
}
