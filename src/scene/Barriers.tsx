import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BARRIERS, BARRIER_STEP } from '../track/props'
import { frameAt } from '../track/trackFrame'

const SEGMENT_GAP = 0.2
const SEGMENT_WIDTH = 0.5
const SEGMENT_HEIGHT = 1

const WHITE = new THREE.Color('#e8e8e4')
const RED = new THREE.Color('#c81414')

const dummy = new THREE.Object3D()

/**
 * TecPro barrier lines, both sides, alternating white and red.
 *
 * Short segments rather than one long wall: on the outside of a corner a long
 * segment leaves a visible gap at each joint, and at this length the chord
 * across the tightest radius deviates by under two centimetres.
 *
 * No vertexColors here. That flag reads a per-vertex `color` geometry attribute
 * which BoxGeometry does not have, an unbound one reads as (0,0,0), and three
 * multiplies vColor by it BEFORE applying the instance colour, zeroing every
 * segment to black. setColorAt enables instance colouring on its own.
 */
export function Barriers() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(
    () => new THREE.BoxGeometry(SEGMENT_WIDTH, SEGMENT_HEIGHT, BARRIER_STEP - SEGMENT_GAP),
    [],
  )
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 1, envMapIntensity: 0.3 }),
    [],
  )

  useLayoutEffect(() => {
    BARRIERS.forEach((p, i) => {
      const fr = frameAt(p.s)
      dummy.position.set(fr.x + fr.lx * p.d, SEGMENT_HEIGHT / 2, fr.z + fr.lz * p.d)
      dummy.rotation.set(0, Math.atan2(fr.tx, fr.tz), 0)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
      // Both sides are written in the same pass, so step the colour every two
      // instances to keep the stripes in phase across the track.
      ref.current.setColorAt(i, i % 4 < 2 ? WHITE : RED)
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, BARRIERS.length]}
      castShadow={false}
      receiveShadow={false}
      raycast={() => null}
    />
  )
}
