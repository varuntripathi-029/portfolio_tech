import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GRANDSTANDS } from '../track/props'
import { frameAt } from '../track/trackFrame'

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
    // Tiers rise going away from the track, so the stand faces the racing line.
    box.translate(0, STEP_HEIGHT / 2 + s * STEP_HEIGHT, s * 1.2)
    parts.push(box)
  }
  return mergeGeometries(parts)
}

/**
 * Blocky stepped silhouettes. No seats, no people, no glowing dots.
 *
 * OUTSIDE the loop only, which props.ts enforces by deriving the lateral offset
 * from the winding rather than mirroring it. At this distance from the
 * centreline an inside placement lands on another part of the circuit, and the
 * clearance assertion would catch it.
 */
export function Grandstands() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(buildGrandstandGeometry, [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#555a63', roughness: 1 }),
    [],
  )

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    GRANDSTANDS.forEach((p, i) => {
      const fr = frameAt(p.s)
      dummy.position.set(fr.x + fr.lx * p.d, 0, fr.z + fr.lz * p.d)
      // Width runs along the track, so the long face looks at the racing line.
      dummy.rotation.set(0, Math.atan2(fr.tx, fr.tz), 0)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <instancedMesh ref={ref} args={[geometry, material, GRANDSTANDS.length]} raycast={() => null} />
  )
}
