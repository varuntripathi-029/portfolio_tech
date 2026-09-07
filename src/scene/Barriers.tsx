import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BARRIER_X, TRACK_LENGTH } from './trackLayout'

const SEGMENT_LENGTH = 4
const SEGMENT_GAP = 0.2
const SEGMENT_WIDTH = 0.5
const SEGMENT_HEIGHT = 1
const COUNT = Math.floor(TRACK_LENGTH / SEGMENT_LENGTH)

const WHITE = new THREE.Color('#e8e8e4')
const RED = new THREE.Color('#c81414')

const dummy = new THREE.Object3D()

/** One TecPro barrier line, alternating white/red segments via instanceColor. */
function BarrierLine({ x }: { x: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(
    () => new THREE.BoxGeometry(SEGMENT_WIDTH, SEGMENT_HEIGHT, SEGMENT_LENGTH - SEGMENT_GAP),
    [],
  )
  // Fully matte plus a reduced envMapIntensity: flat paint under a bright
  // sunset sky was still picking up enough sky wash to hide the alternating
  // colour (see PHASE3_NOTES.md).
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, envMapIntensity: 0.3 }),
    [],
  )

  useLayoutEffect(() => {
    for (let i = 0; i < COUNT; i++) {
      dummy.position.set(x, SEGMENT_HEIGHT / 2, i * SEGMENT_LENGTH + SEGMENT_LENGTH / 2)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
      ref.current.setColorAt(i, i % 2 === 0 ? WHITE : RED)
    }
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [x])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, COUNT]}
      castShadow={false}
      receiveShadow={false}
      raycast={() => null}
    />
  )
}

export function Barriers() {
  return (
    <>
      <BarrierLine x={-BARRIER_X} />
      <BarrierLine x={BARRIER_X} />
    </>
  )
}
