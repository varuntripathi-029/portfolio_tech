import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import * as THREE from 'three'
import { useCarStore } from '../state/carStore'
import { useRaceStore } from '../state/raceStore'
import { frameAt } from '../track/trackFrame'
import { RUMBLE_D } from '../sim/carSpec'
import { LAUNCH_DURATION } from './Car'

/**
 * Chase offsets are CAR-LOCAL, expressed along the car basis rather than in
 * world space.
 *
 * v1 used a world-space (0, 2.6, -8), which is only correct while the car
 * drives along +Z forever. On a closed circuit that offset points the camera at
 * the outside of every corner and eventually at the car flank.
 *
 * Components are (lateral, up, along). The car spans z -2.58 to +2.42 at scale
 * 0.7, so -8 along clears the rear wing.
 */
const RIG_LATERAL = 0
const RIG_UP = 2.6
const RIG_ALONG = -8

const LOOK_UP = 0.8
const LOOK_ALONG = 6

const FOLLOW_RATE = 4 // per second, exponential smoothing

const BASE_FOV = 55
const WARP_FOV = 88

// The only consequence of running wide. Fast enough to read as a rumble strip
// rather than a camera fault, and small enough not to fight the follow lag.
const RUMBLE_HZ = 24
const RUMBLE_Y = 0.07
const RUMBLE_X = 0.04
const RUMBLE_FULL_SPEED = 40

/**
 * The load-state and lights rig: in front of the car at roughly 25 degrees off
 * the nose, per spec 7.1. Radius chosen so it reads as "the car's best angle",
 * not a straight-on ID photo.
 */
const FRONT_ANGLE_DEG = 25
const FRONT_RADIUS = 7
const FRONT_LATERAL = FRONT_RADIUS * Math.sin((FRONT_ANGLE_DEG * Math.PI) / 180)
const FRONT_ALONG = FRONT_RADIUS * Math.cos((FRONT_ANGLE_DEG * Math.PI) / 180)
const FRONT_UP = 2.0

/** Short camera kick on a section stop, decaying over this many seconds. */
const JOLT_DURATION = 0.22
const JOLT_STRENGTH = 0.16

const desired = new THREE.Vector3()
const carPos = new THREE.Vector3()
const lookAt = new THREE.Vector3()
const orbitPos = new THREE.Vector3()
const orbitLook = new THREE.Vector3()

/** Punches out at mid-warp and returns to base at both ends. */
function warpFov(progress: number): number {
  const punch = Math.sin(progress * Math.PI) // 0 -> 1 -> 0
  return THREE.MathUtils.lerp(BASE_FOV, WARP_FOV, punch)
}

/**
 * Front and chase rig offsets, expressed as (radius, angle-from-tangent, up)
 * rather than raw (lateral, along) so the orbit between them can interpolate
 * radius and angle instead of a straight XYZ lerp.
 *
 * A straight lerp from a point in front of the car to a point behind it
 * passes through the bodywork. Interpolating angle sweeps AROUND the car at a
 * roughly constant radius instead, the same way a boom operator would move.
 */
const FRONT_POLAR = {
  radius: FRONT_RADIUS,
  angle: Math.atan2(FRONT_LATERAL, FRONT_ALONG),
  up: FRONT_UP,
}
const CHASE_RADIUS = Math.hypot(RIG_LATERAL, RIG_ALONG)
const CHASE_POLAR = {
  radius: CHASE_RADIUS,
  angle: Math.atan2(RIG_LATERAL, RIG_ALONG),
  up: RIG_UP,
}

/**
 * Orbits between the front rig and the chase rig, arcing on the side the
 * front rig already sits on so the sweep never crosses back through zero
 * radius near the car.
 */
function orbitRig(t: number, out: THREE.Vector3) {
  // FRONT_POLAR.angle is +25deg (~0.44 rad); CHASE_POLAR.angle is +180deg (pi
  // rad, directly behind), with RIG_LATERAL = 0. Lerping angle directly sweeps
  // from 25deg up to 180deg monotonically, on the +lateral side the whole
  // way, so it never crosses back through the car.
  const angle = THREE.MathUtils.lerp(FRONT_POLAR.angle, CHASE_POLAR.angle, t)
  const radius = THREE.MathUtils.lerp(FRONT_POLAR.radius, CHASE_POLAR.radius, t)
  const up = THREE.MathUtils.lerp(FRONT_POLAR.up, CHASE_POLAR.up, t)
  out.set(Math.sin(angle) * radius, up, Math.cos(angle) * radius)
}

export function ChaseCam() {
  const camera = useThree((s) => s.camera)
  const reduce = useReducedMotion()
  /**
   * The smoothed rig position, kept apart from camera.position so the rumble
   * and jolt offsets are never fed back into the next frame lerp as real
   * displacement.
   */
  const base = useRef(new THREE.Vector3())
  const primed = useRef(false)

  /**
   * 0 = front rig, 1 = chase rig. Eased toward `blendTarget` at a rate that
   * completes the orbit in LAUNCH_DURATION; reduced motion snaps instead of
   * easing, per spec 7.2's "under reduced motion: cut".
   */
  const blend = useRef(0)
  const blendTarget = useRef(0)
  const lastPhase = useRef<string>('lights')

  const jolt = useRef(0)

  useFrame((state, rawDelta) => {
    // Same reasoning as Car.tsx: an alt-tab or a stalled frame hands back a
    // huge delta, and an unclamped one snaps the camera straight to its target,
    // erasing the follow lag for a single jarring frame.
    const delta = Math.min(rawDelta, 1 / 30)

    const { s, d, v, warpProgress } = useCarStore.getState()
    const phase = useRaceStore.getState().phase
    const warping = warpProgress >= 0

    // Blend target follows the phase: front for the grid wait, the launch
    // orbit and the dry stop; chase for everything that is actually driving.
    if (phase !== lastPhase.current) {
      if (phase === 'stopped' && lastPhase.current === 'arriving') jolt.current = JOLT_DURATION
      if (phase === 'dry' && lastPhase.current === 'arriving') jolt.current = JOLT_DURATION
      lastPhase.current = phase
    }
    blendTarget.current = phase === 'lights' || phase === 'dry' || phase === 'creeping' ? 0 : 1

    if (reduce) {
      blend.current = blendTarget.current
    } else {
      const rate = delta / LAUNCH_DURATION
      if (blend.current < blendTarget.current) blend.current = Math.min(blendTarget.current, blend.current + rate)
      else if (blend.current > blendTarget.current) blend.current = Math.max(blendTarget.current, blend.current - rate)
    }

    const fr = frameAt(s)
    carPos.set(fr.x + fr.lx * d, 0, fr.z + fr.lz * d)

    if (blend.current < 1) {
      // Orbiting (or parked at the front rig): build the offset from the
      // interpolated polar rig in the car's local basis (tangent, left, up).
      orbitRig(blend.current, orbitPos)
      desired.set(
        carPos.x + fr.lx * orbitPos.x + fr.tx * orbitPos.z,
        orbitPos.y,
        carPos.z + fr.lz * orbitPos.x + fr.tz * orbitPos.z,
      )
      // Look toward the car, blending from "at the car" (front view) to
      // "ahead of the car" (chase view) as the orbit progresses.
      orbitLook.set(
        carPos.x + fr.tx * LOOK_ALONG * blend.current,
        THREE.MathUtils.lerp(1.0, LOOK_UP, blend.current),
        carPos.z + fr.tz * LOOK_ALONG * blend.current,
      )
    } else {
      // Build the offset out of the car basis so the rig follows the curve.
      desired.set(
        carPos.x + fr.lx * RIG_LATERAL + fr.tx * RIG_ALONG,
        RIG_UP,
        carPos.z + fr.lz * RIG_LATERAL + fr.tz * RIG_ALONG,
      )
      orbitLook.set(carPos.x + fr.tx * LOOK_ALONG, LOOK_UP, carPos.z + fr.tz * LOOK_ALONG)
    }

    if (!primed.current) {
      base.current.copy(desired)
      primed.current = true
    }

    if (warping) {
      // Rigid attachment. At warp speeds the follow lag would leave the rig
      // hundreds of metres behind the car, and the feed-forward correction that
      // normally cancels it would overshoot just as far the other way.
      base.current.copy(desired)
    } else if (blend.current < 1) {
      // Mid-orbit (or parked front): no feed-forward lag term, since the car
      // is stationary through 'lights', 'launching' and 'dry'.
      base.current.copy(desired)
    } else {
      // Feed-forward: exponential smoothing alone settles at a lag of
      // speed / FOLLOW_RATE behind a constantly-moving target, so push the
      // target ahead ALONG THE TANGENT by that same amount to cancel the
      // steady-state error. Smoothing still absorbs the transient during
      // acceleration and braking.
      const lead = v / FOLLOW_RATE
      desired.x += fr.tx * lead
      desired.z += fr.tz * lead
      const t = 1 - Math.exp(-FOLLOW_RATE * delta)
      base.current.lerp(desired, t)
    }

    camera.position.copy(base.current)

    // Kerb rumble. Two bugs from the last build, both fixed here:
    //
    // 1. It tested the car CENTRELINE against the kerb edge. By then the outer
    //    wheel had been on the kerb for about 1.1m of travel, so the rumble
    //    started late over a band under a metre wide. RUMBLE_D is derived from
    //    the wheel half-track, so this fires when the WHEEL touches.
    // 2. It had no phase check, so the automatic pit lateral lerp triggered it.
    //    Pit entry is gone but the class of bug is not: without this gate the
    //    warp arrival and the grid roll would set it off.
    const canRumble = phase === 'driving' || phase === 'arriving'
    if (canRumble && !warping && Math.abs(d) >= RUMBLE_D) {
      const intensity = Math.min(1, v / RUMBLE_FULL_SPEED)
      const cycle = state.clock.elapsedTime * RUMBLE_HZ * Math.PI * 2
      camera.position.y += Math.sin(cycle) * RUMBLE_Y * intensity
      // A different multiple, so the two axes never trace a straight line.
      camera.position.x += Math.sin(cycle * 0.63) * RUMBLE_X * intensity
    }

    // Section-stop camera jolt: a short decaying kick applied once, on the
    // frame the car actually comes to rest. Same base-vector discipline as
    // the rumble, so it never becomes real displacement next frame.
    if (jolt.current > 0) {
      const j = reduce ? 0 : (jolt.current / JOLT_DURATION) * JOLT_STRENGTH
      camera.position.y -= j
      jolt.current = Math.max(0, jolt.current - delta)
    }

    const perspective = camera as THREE.PerspectiveCamera
    const targetFov = warping ? warpFov(warpProgress) : BASE_FOV
    if (Math.abs(perspective.fov - targetFov) > 0.01) {
      // Eased even on the way back, so the FOV never snaps on warp exit.
      perspective.fov = THREE.MathUtils.lerp(perspective.fov, targetFov, warping ? 0.35 : 0.12)
      perspective.updateProjectionMatrix()
    }

    if (warping) {
      lookAt.set(carPos.x + fr.tx * LOOK_ALONG, LOOK_UP, carPos.z + fr.tz * LOOK_ALONG)
    } else {
      lookAt.copy(orbitLook)
    }
    camera.lookAt(lookAt)
  })

  return null
}
