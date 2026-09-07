import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TRACK_LENGTH } from './trackLayout'

const SPAN = 36 // clears both barriers (BARRIER_X=17) with margin
const HEIGHT = 8
const BEAM_THICKNESS = 0.6
const LEG_SIZE = 0.5
const SPACING = 200

function buildGantryGeometry(): THREE.BufferGeometry {
  const beam = new THREE.BoxGeometry(SPAN, BEAM_THICKNESS, BEAM_THICKNESS)
  beam.translate(0, HEIGHT, 0)

  const legLeft = new THREE.BoxGeometry(LEG_SIZE, HEIGHT, LEG_SIZE)
  legLeft.translate(-SPAN / 2, HEIGHT / 2, 0)

  const legRight = new THREE.BoxGeometry(LEG_SIZE, HEIGHT, LEG_SIZE)
  legRight.translate(SPAN / 2, HEIGHT / 2, 0)

  return mergeGeometries([beam, legLeft, legRight])
}

/** Overhead gantry every 200m. One merged shape (beam + two legs), instanced. */
export function GantryBridges() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(buildGantryGeometry, [])
  const material = useMemo(
    // Roughness 1 avoids the sunset sky's specular washing the structure
    // out (same issue found on the LED boards and barriers); metalness
    // dropped for the same reason.
    () => new THREE.MeshStandardMaterial({ color: '#3a3a42', roughness: 1, metalness: 0.1 }),
    [],
  )

  const zPositions = useMemo(() => {
    const arr: number[] = []
    for (let z = SPACING; z < TRACK_LENGTH; z += SPACING) arr.push(z)
    return arr
  }, [])

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    zPositions.forEach((z, i) => {
      dummy.position.set(0, 0, z)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [zPositions])

  return <instancedMesh ref={ref} args={[geometry, material, zPositions.length]} raycast={() => null} />
}
