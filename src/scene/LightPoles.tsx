import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BARRIER_X, TRACK_LENGTH } from './trackLayout'

const POLE_HEIGHT = 6
const POLE_RADIUS = 0.15
const HEAD_SIZE = 0.6
const POLE_X = BARRIER_X + 6
const SPACING = 60

function buildPoleGeometry(): THREE.BufferGeometry {
  const pole = new THREE.CylinderGeometry(POLE_RADIUS, POLE_RADIUS, POLE_HEIGHT, 6)
  pole.translate(0, POLE_HEIGHT / 2, 0)

  const head = new THREE.BoxGeometry(HEAD_SIZE, HEAD_SIZE * 0.6, HEAD_SIZE)
  head.translate(0, POLE_HEIGHT, 0)

  return mergeGeometries([pole, head])
}

/** Silhouette props only, not emissive, no lighting role. Both sides, one draw call. */
export function LightPoles() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(buildPoleGeometry, [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#25252b', roughness: 1 }), [])

  const instances = useMemo(() => {
    const arr: { x: number; z: number }[] = []
    for (let z = SPACING / 2; z < TRACK_LENGTH; z += SPACING) {
      arr.push({ x: -POLE_X, z })
      arr.push({ x: POLE_X, z })
    }
    return arr
  }, [])

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    instances.forEach(({ x, z }, i) => {
      dummy.position.set(x, 0, z)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [instances])

  return <instancedMesh ref={ref} args={[geometry, material, instances.length]} raycast={() => null} />
}
