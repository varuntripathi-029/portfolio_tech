import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useCarStore } from '../state/carStore'

// The car spans z -2.58 to +2.42 at scale 0.7, so -8 clears the rear wing.
const RIG_OFFSET = new THREE.Vector3(0, 2.6, -8)
const LOOK_OFFSET = new THREE.Vector3(0, 0.8, 6)
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

    const { z, speed } = useCarStore.getState()
    carPos.set(0, 0, z)
    desired.copy(carPos).add(RIG_OFFSET)
    // Feed-forward: exponential smoothing alone settles at a lag of
    // speed / FOLLOW_RATE behind a constantly-moving target. Motion here is
    // purely +Z at a known speed, so push the target ahead by that same
    // amount to cancel the steady-state error; smoothing still absorbs the
    // transient during accel and braking.
    desired.z += speed / FOLLOW_RATE

    const t = 1 - Math.exp(-FOLLOW_RATE * delta)
    camera.position.lerp(desired, t)

    lookAt.copy(carPos).add(LOOK_OFFSET)
    camera.lookAt(lookAt)
  })

  return null
}
