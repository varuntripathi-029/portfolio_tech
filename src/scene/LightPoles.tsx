import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LIGHT_POLES } from '../track/props'
import { frameAt } from '../track/trackFrame'

const POLE_HEIGHT = 6
const POLE_RADIUS = 0.15
const HEAD_SIZE = 0.6

function buildPoleGeometry(): THREE.BufferGeometry {
  const pole = new THREE.CylinderGeometry(POLE_RADIUS, POLE_RADIUS, POLE_HEIGHT, 6)
  pole.translate(0, POLE_HEIGHT / 2, 0)
  const head = new THREE.BoxGeometry(HEAD_SIZE, HEAD_SIZE * 0.6, HEAD_SIZE)
  head.translate(0, POLE_HEIGHT, 0)
  return mergeGeometries([pole, head])
}

/** Silhouette props only, not emissive, no lighting role. Both sides. */
export function LightPoles() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(buildPoleGeometry, [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#25252b', roughness: 1 }),
    [],
  )

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    LIGHT_POLES.forEach((p, i) => {
      const fr = frameAt(p.s)
      dummy.position.set(fr.x + fr.lx * p.d, 0, fr.z + fr.lz * p.d)
      dummy.rotation.set(0, Math.atan2(fr.tx, fr.tz), 0)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <instancedMesh ref={ref} args={[geometry, material, LIGHT_POLES.length]} raycast={() => null} />
  )
}
