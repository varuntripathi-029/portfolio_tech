import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useCarStore } from '../state/carStore'

// ~3m behind, ~1.5m above (car faces +Z, so "behind" is -Z).
const RIG_OFFSET = new THREE.Vector3(0, 1.5, -3)
const LOOK_OFFSET = new THREE.Vector3(0, 0.6, 5)
const FOLLOW_RATE = 4 // per second, exponential smoothing

const desired = new THREE.Vector3()
const carPos = new THREE.Vector3()
const lookAt = new THREE.Vector3()

export function ChaseCam() {
  const camera = useThree((s) => s.camera)

  useFrame((_, rawDelta) => {
    // Same reasoning as Car.tsx: an alt-tab or a stalled frame can hand
    // back a huge delta, and an unclamped one snaps the camera straight to
    // its target, erasing the follow lag for a single, jarring frame.
    const delta = Math.min(rawDelta, 1 / 30)

    const z = useCarStore.getState().z
    carPos.set(0, 0, z)
    desired.copy(carPos).add(RIG_OFFSET)

    const t = 1 - Math.exp(-FOLLOW_RATE * delta)
    camera.position.lerp(desired, t)

    lookAt.copy(carPos).add(LOOK_OFFSET)
    camera.lookAt(lookAt)
  })

  return null
}
