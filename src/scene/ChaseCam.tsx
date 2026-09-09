import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useCarStore } from '../state/carStore'

// The car spans z -2.58 to +2.42 at scale 0.7, so -8 clears the rear wing.
const RIG_OFFSET = new THREE.Vector3(0, 2.6, -8)
const LOOK_OFFSET = new THREE.Vector3(0, 0.8, 6)
const FOLLOW_RATE = 4 // per second, exponential smoothing

const BASE_FOV = 55
const JUMP_FOV = 88

const desired = new THREE.Vector3()
const carPos = new THREE.Vector3()
const lookAt = new THREE.Vector3()

/** Punches out at mid-jump and returns to base at both ends. */
function jumpFov(progress: number): number {
  const punch = Math.sin(progress * Math.PI) // 0 -> 1 -> 0
  return THREE.MathUtils.lerp(BASE_FOV, JUMP_FOV, punch)
}

export function ChaseCam() {
  const camera = useThree((s) => s.camera)

  useFrame((_, rawDelta) => {
    // Same reasoning as Car.tsx: an alt-tab or a stalled frame can hand
    // back a huge delta, and an unclamped one snaps the camera straight to
    // its target, erasing the follow lag for a single, jarring frame.
    const delta = Math.min(rawDelta, 1 / 30)

    const { x, z, speed, jumpProgress } = useCarStore.getState()
    const jumping = jumpProgress >= 0

    carPos.set(x, 0, z)
    desired.copy(carPos).add(RIG_OFFSET)

    if (jumping) {
      // Rigid attachment. At jump speeds the follow lag would leave the rig
      // hundreds of metres behind the car, and the feed-forward correction
      // that normally cancels it would overshoot just as far the other way.
      camera.position.copy(desired)
    } else {
      // Feed-forward: exponential smoothing alone settles at a lag of
      // speed / FOLLOW_RATE behind a constantly-moving target. Motion here is
      // purely +Z at a known speed, so push the target ahead by that same
      // amount to cancel the steady-state error; smoothing still absorbs the
      // transient during accel and braking.
      desired.z += speed / FOLLOW_RATE
      const t = 1 - Math.exp(-FOLLOW_RATE * delta)
      camera.position.lerp(desired, t)
    }

    const perspective = camera as THREE.PerspectiveCamera
    const targetFov = jumping ? jumpFov(jumpProgress) : BASE_FOV
    if (Math.abs(perspective.fov - targetFov) > 0.01) {
      // Eased even on the way back so the FOV never snaps on jump exit.
      perspective.fov = THREE.MathUtils.lerp(perspective.fov, targetFov, jumping ? 0.35 : 0.12)
      perspective.updateProjectionMatrix()
    }

    lookAt.copy(carPos).add(LOOK_OFFSET)
    camera.lookAt(lookAt)
  })

  return null
}
