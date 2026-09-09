import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useCarStore } from '../state/carStore'
import { useRaceStore } from '../state/raceStore'
import { TRACK_LENGTH, PIT_ENTRY_LEAD, PIT_EXIT_LEAD, PIT_BAY_X } from './trackLayout'
import { TIMELINE } from '../data/timeline'

// drei's default decoder path is Google's CDN. Self-hosting avoids a
// runtime dependency on an external host for something this core.
useGLTF.setDecoderPath('/draco/')

export const CAR_SCALE = 0.7
// Model-space wheel radius (spec: node Y = wheel centre height). World-space
// rolling radius is this times the group scale, since the group's own
// position moves in world metres regardless of its child scale.
const WHEEL_RADIUS = 0.56

const ACCEL = 14 // m/s^2 while W is held
const BRAKE_DECEL = 26 // m/s^2 while S is held
const COAST_DECEL = 5 // m/s^2 drag with no input, so speed changes are never instant
const MAX_SPEED = 85 // m/s, a driveable top end, not a real-world F1 figure
export const JUMP_DURATION = 1.5 // seconds, constant regardless of distance
export const END_Z = 2350 // the fuel-out stop, past the last event

/**
 * Short acceleration, long deceleration. Velocity ramps linearly for the first
 * ACCEL_FRACTION of the flight, then decays quadratically to zero at arrival.
 *
 * A plain ease-out quint was tried first and read as a teleport followed by a
 * drift: its velocity peaks at t=0, so roughly 60 percent of a 2000m jump
 * happened in the first fifth of a second. Ramping in gives the eye something
 * to track leaving the stop, and the quadratic tail is what makes the arrival
 * feel braked rather than merely stopped.
 */
const ACCEL_FRACTION = 0.3
// Peak velocity, in units of (total distance / total duration), chosen so the
// two phases integrate to exactly 1.
const PEAK_V = 1 / (ACCEL_FRACTION / 2 + (1 - ACCEL_FRACTION) / 3)

function jumpEase(t: number): number {
  if (t < ACCEL_FRACTION) {
    return (PEAK_V * t * t) / (2 * ACCEL_FRACTION)
  }
  const k = (t - ACCEL_FRACTION) / (1 - ACCEL_FRACTION)
  return (
    (PEAK_V * ACCEL_FRACTION) / 2 +
    PEAK_V * (1 - ACCEL_FRACTION) * (1 - Math.pow(1 - k, 3)) / 3
  )
}

const ENTER_DECEL = 25 // m/s^2, automatic braking into a pit stop
const JUMP_ARRIVAL_SPEED = 60 // m/s handed to 'entering' at the end of a jump
const MIN_ENTER_SPEED = 4 // m/s, keeps the car creeping toward the bay instead of stalling short

function useDriveInput() {
  // wJustPressed is set on the keydown that transitions 0 -> held, and
  // consumed (reset) the next time a frame reads it, so it behaves as a
  // one-shot edge regardless of how long a frame takes to come around.
  const input = useRef({ forward: false, brake: false, wJustPressed: false })

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W') {
        if (!input.current.forward) input.current.wJustPressed = true
        input.current.forward = true
      }
      if (e.key === 's' || e.key === 'S') input.current.brake = true
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W') input.current.forward = false
      if (e.key === 's' || e.key === 'S') input.current.brake = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  return input
}

export function Car() {
  const { scene, nodes } = useGLTF('/models/car.glb')
  const group = useRef<THREE.Group>(null!)
  const input = useDriveInput()
  // Authoritative per-frame physics state. Mirrored into carStore each
  // frame for the camera, HUD and wheel spin to read.
  const phys = useRef({ z: 0, x: 0, speed: 0 })
  // Captured on the first frame of a jump so the interpolation has a fixed
  // origin; target identity is what tells us a new jump has been requested.
  const jump = useRef<{ target: unknown; from: number; fromX: number; to: number; elapsed: number }>({
    target: null,
    from: 0,
    fromX: 0,
    to: 0,
    elapsed: 0,
  })

  // One-time fixes verified from parsing the source GLB directly (see spec
  // "Required fixes on load"), not guesses.
  useEffect(() => {
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const material = child.material as THREE.MeshStandardMaterial

      // Sketchfab's fake ground-AO disc: alpha-blended with no texture, and
      // it would otherwise slide along under the car as a translucent circle.
      if (material?.name === 'Default_Material.008') {
        child.visible = false
        return
      }

      material.side = THREE.FrontSide

      // The two tyre materials carry COLOR_0 vertex colours that render the
      // wheels unexpectedly dark.
      if (child.geometry.attributes.color) {
        material.vertexColors = false
      }

      // Diffuse-only 2002 model, no normal or metal-rough maps, so the PBR
      // values need to be set explicitly or it reads as flat grey.
      material.metalness = 0.15
      material.roughness = 0.55
      material.envMapIntensity = 0.8
      material.needsUpdate = true

      child.castShadow = true
    })
  }, [scene])

  // Negative priority so this runs before ChaseCam. Both defaulted to 0, and
  // Car mounts second (it suspends on the GLTF), so the camera was reading a
  // one-frame-stale position. Harmless at driving speed, but a jump peaks
  // near 4000 m/s and the rig fell hundreds of metres behind.
  // Only a POSITIVE priority hands rendering to the app, so -1 is safe here.
  useFrame((_, rawDelta) => {
    // The frame clock keeps running during the async GLTF load, so the
    // first frame after Suspense resolves can report a multi-second delta.
    // Clamp it or that one frame launches the car hundreds of metres.
    const delta = Math.min(rawDelta, 1 / 30)
    const { forward, brake, wJustPressed } = input.current
    input.current.wJustPressed = false // consume the edge

    const race = useRaceStore.getState()
    const p = phys.current

    switch (race.phase) {
      case 'lights': {
        // Grid, lights sequence, driver stats: all DOM. The car just waits.
        if (wJustPressed) useRaceStore.getState().setPhase('driving')
        break
      }

      case 'driving': {
        if (race.fuelLow) {
          // Out of fuel: input stops mattering, the car just coasts down.
          p.speed = Math.max(0, p.speed - COAST_DECEL * delta)
          p.z += p.speed * delta
          if (p.speed <= 0.05) {
            p.speed = 0
            useRaceStore.getState().setPhase('ended')
          }
          break
        }

        if (forward) p.speed += ACCEL * delta
        else if (brake) p.speed -= BRAKE_DECEL * delta
        else p.speed -= COAST_DECEL * delta
        p.speed = THREE.MathUtils.clamp(p.speed, 0, MAX_SPEED)
        p.z = THREE.MathUtils.clamp(p.z + p.speed * delta, 0, TRACK_LENGTH)

        const nextIndex = race.activeEventIndex + 1
        const nextEvent = TIMELINE[nextIndex]
        if (nextEvent && p.z >= nextEvent.trackZ - PIT_ENTRY_LEAD) {
          useRaceStore.getState().setActiveEventIndex(nextIndex)
          useRaceStore.getState().setPhase('entering')
        }
        break
      }

      case 'entering': {
        const event = TIMELINE[race.activeEventIndex]
        // A floor on speed, not 0: decelerating all the way to a stop
        // before z reaches trackZ would leave speed*delta at 0 forever,
        // stranding the car mid pit-lane with nothing left to advance z.
        p.speed = Math.max(MIN_ENTER_SPEED, p.speed - ENTER_DECEL * delta)
        // z is clamped to the bay position so the car always actually
        // reaches it and stops, regardless of how fast it was going in.
        p.z = Math.min(p.z + p.speed * delta, event.trackZ)
        const t = THREE.MathUtils.clamp((p.z - (event.trackZ - PIT_ENTRY_LEAD)) / PIT_ENTRY_LEAD, 0, 1)
        p.x = PIT_BAY_X * t
        if (p.z >= event.trackZ) {
          p.z = event.trackZ
          p.x = PIT_BAY_X
          p.speed = 0
          useRaceStore.getState().setPhase('stopped')
        }
        break
      }

      case 'stopped': {
        if (wJustPressed) useRaceStore.getState().setPhase('leaving')
        break
      }

      case 'leaving': {
        const event = TIMELINE[race.activeEventIndex]
        p.speed = Math.min(MAX_SPEED, p.speed + ACCEL * delta)
        p.z += p.speed * delta
        const t = THREE.MathUtils.clamp((p.z - event.trackZ) / PIT_EXIT_LEAD, 0, 1)
        p.x = PIT_BAY_X * (1 - t)
        if (t >= 1) {
          p.x = 0
          const wasLastEvent = race.activeEventIndex === TIMELINE.length - 1
          if (wasLastEvent) useRaceStore.getState().setFuelLow(true)
          useRaceStore.getState().setPhase('driving')
        }
        break
      }

      case 'jumping': {
        const target = race.jumpTarget
        if (!target) {
          useRaceStore.getState().setPhase('driving')
          break
        }

        if (jump.current.target !== target) {
          // Land at the pit entry lead so the ordinary 'entering' logic runs
          // on arrival and the card appears exactly as it does when driving.
          const to =
            target.kind === 'event'
              ? Math.max(0, TIMELINE[target.index].trackZ - PIT_ENTRY_LEAD)
              : target.kind === 'grid'
                ? 0
                : END_Z
          jump.current = { target, from: p.z, fromX: p.x, to, elapsed: 0 }
        }

        jump.current.elapsed += delta
        const t = THREE.MathUtils.clamp(jump.current.elapsed / JUMP_DURATION, 0, 1)
        const eased = jumpEase(t)

        const previousZ = p.z
        p.z = THREE.MathUtils.lerp(jump.current.from, jump.current.to, eased)
        // Rejoin the racing line early rather than dragging the pit offset
        // across the whole flight.
        p.x = THREE.MathUtils.lerp(jump.current.fromX, 0, Math.min(1, eased * 3))
        // Real velocity, so the wheels spin at the right rate. It is not written
        // to carStore during a jump: the camera's feed-forward term would push
        // the rig hundreds of metres ahead at these speeds.
        p.speed = Math.abs(p.z - previousZ) / Math.max(delta, 1e-4)
        useCarStore.getState().setJumpProgress(t)

        if (t >= 1) {
          const race2 = useRaceStore.getState()
          jump.current.target = null
          useCarStore.getState().setJumpProgress(-1)
          p.x = 0

          if (target.kind === 'event') {
            // 'entering' decays speed toward a 4 m/s floor. Arriving at 0
            // would leave the car creeping the last 60m for fifteen seconds,
            // so hand it a realistic entry speed and let the existing
            // deceleration do the braking.
            p.speed = JUMP_ARRIVAL_SPEED
            race2.setActiveEventIndex(target.index)
            race2.setFuelLow(false)
            race2.setPhase('entering')
          } else if (target.kind === 'grid') {
            p.speed = 0
            p.z = 0
            race2.reset()
          } else {
            p.speed = 0
            p.z = END_Z
            race2.setActiveEventIndex(TIMELINE.length - 1)
            race2.setFuelLow(true)
            race2.setPhase('ended')
          }
        }
        break
      }

      case 'ended': {
        if (wJustPressed) {
          p.z = 0
          p.x = 0
          p.speed = 0
          useRaceStore.getState().reset()
        }
        break
      }
    }

    // Jump speeds are orders of magnitude above driving speeds; publishing
    // them would drive the camera's feed-forward off the end of the track.
    useCarStore.getState().set(p.z, race.phase === 'jumping' ? 0 : p.speed, p.x)
    group.current.position.set(p.x, 0, p.z)

    const wheelSpin = (p.speed / (WHEEL_RADIUS * CAR_SCALE)) * delta
    const rearWheels = nodes['tires.003']
    const frontLeft = nodes['tires.002']
    const frontRight = nodes['tires.001']
    if (rearWheels) rearWheels.rotation.x += wheelSpin
    if (frontLeft) frontLeft.rotation.x += wheelSpin
    if (frontRight) frontRight.rotation.x += wheelSpin
  }, -1)

  return (
    <group ref={group} scale={CAR_SCALE}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/models/car.glb')
