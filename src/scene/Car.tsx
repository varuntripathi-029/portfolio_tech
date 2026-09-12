import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useCarStore } from '../state/carStore'
import { useRaceStore } from '../state/raceStore'
import { SECTIONS, sectionById } from '../data/sections'
import { TRACK_LENGTH, curvatureAt, frameAt, wrapS } from '../track/trackFrame'
import { createCarState, stepCar, stopDistance, type CarInput } from '../sim/car'
import { CAR_SCALE } from '../sim/carSpec'
import { useIsTouchDevice } from '../ui/useTouch'

// drei defaults the decoder path to Google's CDN. Self-hosting avoids a runtime
// dependency on an external host for something this core.
useGLTF.setDecoderPath('/draco/')

export { CAR_SCALE }

/** Warp duration, constant regardless of distance. */
export const WARP_DURATION = 1.5

/**
 * The 3-2-1 lights plus the front-to-chase camera orbit, timed together so
 * the orbit lands exactly as the lights go out (see ChaseCam.tsx). The lights
 * themselves take 3*550 + 500 = 2150ms; 2.2s gives the orbit a hair of margin
 * to settle rather than snapping the instant the last light dies.
 */
export const LAUNCH_DURATION = 2.2

/** Constant creep speed from CONTACT back to the grid slot, in m/s. */
const CREEP_SPEED = 6

/**
 * Short acceleration, long deceleration. Velocity ramps linearly for the first
 * ACCEL_FRACTION of the flight, then decays quadratically to zero on arrival.
 *
 * A plain ease-out quint was tried in v1 and read as a teleport followed by a
 * drift: its velocity peaks at t=0, so most of the distance happened in the
 * first fifth of a second. Ramping in gives the eye something to track leaving
 * the stop, and the quadratic tail is what makes the arrival feel braked.
 */
const ACCEL_FRACTION = 0.3
const PEAK_V = 1 / (ACCEL_FRACTION / 2 + (1 - ACCEL_FRACTION) / 3)

function warpEase(t: number): number {
  if (t < ACCEL_FRACTION) return (PEAK_V * t * t) / (2 * ACCEL_FRACTION)
  const k = (t - ACCEL_FRACTION) / (1 - ACCEL_FRACTION)
  return (
    (PEAK_V * ACCEL_FRACTION) / 2 +
    (PEAK_V * (1 - ACCEL_FRACTION) * (1 - Math.pow(1 - k, 3))) / 3
  )
}

/** How much the body leans, in radians at full lateral or longitudinal load. */
const ROLL_MAX = 0.055
const PITCH_MAX = 0.035
/** Front wheel yaw at full lateral load. */
const WHEEL_YAW_MAX = 0.32

/**
 * The car axes. Its parent chain is identity, so these are the body lateral
 * (spin) and vertical (steer) axes.
 */
const SPIN_AXIS = new THREE.Vector3(1, 0, 0)
const STEER_AXIS = new THREE.Vector3(0, 1, 0)
const spinQuat = new THREE.Quaternion()
const steerQuat = new THREE.Quaternion()

/**
 * useGLTF caches the parsed scene, so the wheel nodes are shared across every
 * mount and carry whatever the last frame wrote to them. Their authored
 * orientation is captured once per node and never again: re-reading it after a
 * remount would take a mid-spin rotation as the rest position, which is how a
 * transient NaN became permanent in the v1 build.
 */
const authoredQuat = new WeakMap<THREE.Object3D, THREE.Quaternion>()
function restQuat(node: THREE.Object3D): THREE.Quaternion {
  let q = authoredQuat.get(node)
  if (!q) {
    q = node.quaternion.clone()
    authoredQuat.set(node, q)
  }
  return q
}

/**
 * Keyboard state.
 *
 * Arrow keys never steer: steering is A and D only, so there is no collision
 * between the navbar keyboard model and the driving model. That is by
 * construction rather than by suppression.
 */
function useDriveInput(isTouch: boolean) {
  // wJustPressed is set on the keydown that transitions 0 to held, and consumed
  // the next time a frame reads it, so it behaves as a one-shot edge regardless
  // of how long a frame takes to come around.
  const input = useRef({
    throttle: false,
    brake: false,
    left: false,
    right: false,
    handbrake: false,
    wJustPressed: false,
  })

  // Block G4: auto-drive. Any tap anywhere is the touch equivalent of the one
  // W press that starts the lights or leaves a stopped card; continuous
  // throttle while actually driving is applied per-frame in Car's own
  // useFrame, not here, since it depends on the current phase. No drift, no
  // reverse: this listener only ever sets wJustPressed.
  useEffect(() => {
    if (!isTouch) return
    const onTap = () => {
      // The onboarding card is dismissed by its OWN buttons only, never by a
      // tap that happens to land somewhere else on it: found by testing a
      // tap that missed both buttons, which silently launched the car
      // underneath the still-open tutorial (the pointerdown had already
      // bubbled to window before the tutorial's own handler even ran).
      if (!useRaceStore.getState().tutorialSeen) return
      if (!input.current.throttle) input.current.wJustPressed = true
      input.current.throttle = true
    }
    window.addEventListener('pointerdown', onTap)
    return () => window.removeEventListener('pointerdown', onTap)
  }, [isTouch])

  useEffect(() => {
    if (isTouch) return
    // The navbar owns the keyboard while one of its controls has focus. W must
    // not launch the car out from under a reader who is only reading the menu.
    const navHasFocus = () => Boolean(document.activeElement?.closest('[data-nav-root]'))

    const down = (e: KeyboardEvent) => {
      if (navHasFocus()) return
      const k = e.key.toLowerCase()
      if (k === 'w') {
        if (!input.current.throttle) input.current.wJustPressed = true
        input.current.throttle = true
      }
      if (k === 's') input.current.brake = true
      if (k === 'a') input.current.left = true
      if (k === 'd') input.current.right = true
      if (e.code === 'Space') {
        // Space also scrolls the page by default, and there is no scrolling
        // surface under the canvas to preserve that for.
        e.preventDefault()
        input.current.handbrake = true
      }
    }
    const up = (e: KeyboardEvent) => {
      // Never gated on focus: a key released after focus moved into the navbar
      // would otherwise stay stuck down forever.
      const k = e.key.toLowerCase()
      if (k === 'w') input.current.throttle = false
      if (k === 's') input.current.brake = false
      if (k === 'a') input.current.left = false
      if (k === 'd') input.current.right = false
      if (e.code === 'Space') input.current.handbrake = false
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

const track = { length: TRACK_LENGTH, curvatureAt }

/** The next braking stop ahead of an arc length, in lap order. */
function nextStopAfter(s: number) {
  const ordered = SECTIONS.filter((x) => x.kind !== 'grid').sort((a, b) => a.s - b.s)
  for (const stop of ordered) if (stop.s > s + 1) return stop
  return ordered[0]
}

export function Car() {
  const { scene, nodes } = useGLTF('/models/car.glb')
  const group = useRef<THREE.Group>(null!)
  const isTouch = useIsTouchDevice()
  const input = useDriveInput(isTouch)

  const car = useRef(createCarState(0))
  const warp = useRef({ target: null as unknown, from: 0, to: 0, elapsed: 0, progressAtStart: 0 })
  const lastPhase = useRef<string>('lights')
  /** Elapsed time inside the current 'launching' phase. */
  const launchElapsed = useRef(0)
  /** Block F lap timer, milliseconds since lights-out. Reset when a new
   * 'launching' phase begins, frozen (not incremented) outside 'driving' and
   * 'arriving': it measures driving, not reading a card or a navbar warp. */
  const lapElapsed = useRef(0)
  const brakeLightL = useRef<THREE.Mesh>(null!)
  const brakeLightR = useRef<THREE.Mesh>(null!)

  // Dev-only assertions for Block F / F5's four reverse invariants (fire
  // once each, as a console.error, rather than throwing: these guard against
  // a regression during real interactive play, not a condition the app
  // should crash on for a visitor).
  const warnedSectionReverse = useRef(false)
  const warnedContactReverse = useRef(false)
  const warnedFuelRose = useRef(false)

  /**
   * GLTFLoader sanitises node names, so the GLB `tires.001` arrives as
   * `tires001`. The dotted lookup silently returned undefined in v1, which is
   * why none of the wheels ever turned. Both spellings are resolved so the code
   * survives a loader change in either direction.
   */
  const wheels = useMemo(() => {
    const pick = (name: string) =>
      (nodes[name] ?? nodes[name.replace('.', '')]) as THREE.Object3D | undefined
    // tires.003 is the merged rear pair, so it spins but never steers.
    const rear = [pick('tires.003')].filter(Boolean) as THREE.Object3D[]
    const front = [pick('tires.001'), pick('tires.002')].filter(Boolean) as THREE.Object3D[]
    return { rear, front }
  }, [nodes])

  // One-time fixes verified by parsing the source GLB, not guesses.
  useEffect(() => {
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const material = child.material as THREE.MeshStandardMaterial

      // Sketchfab's fake ground-AO disc: alpha-blended with no texture, and it
      // would otherwise slide along under the car as a translucent circle.
      if (material?.name === 'Default_Material.008') {
        child.visible = false
        return
      }

      material.side = THREE.FrontSide

      // The tyre materials carry COLOR_0 vertex colours that render the wheels
      // unexpectedly dark.
      if (child.geometry.attributes.color) material.vertexColors = false

      // Diffuse-only model, no normal or metal-rough maps, so the PBR values
      // have to be set explicitly or it reads as flat grey.
      material.metalness = 0.15
      material.roughness = 0.55
      material.envMapIntensity = 0.8
      material.needsUpdate = true

      child.castShadow = true
    })
  }, [scene])

  // Negative priority so this runs before ChaseCam. Both defaulted to 0 in v1
  // and Car mounts second because it suspends on the GLTF, so the camera read a
  // one-frame-stale position every frame: harmless at driving speed, but a warp
  // peaks near 2000 m/s and the rig fell hundreds of metres behind.
  // Only a POSITIVE priority hands rendering to the app, so -1 is safe.
  useFrame((_, rawDelta) => {
    // The frame clock keeps running during the async GLTF load, so the first
    // frame after Suspense resolves can report a multi-second delta. Clamp it
    // or that one frame launches the car hundreds of metres.
    const delta = Math.min(rawDelta, 1 / 30)
    const race = useRaceStore.getState()
    const p = car.current
    // Block G4 auto-drive: continuous throttle while actually driving, so a
    // tap only ever has to start the car moving, never sustain it. Depends
    // on the current phase, so it lives here rather than in the input
    // listener itself.
    if (isTouch && race.phase === 'driving') input.current.throttle = true
    const { throttle, brake, left, right, handbrake, wJustPressed } = input.current
    input.current.wJustPressed = false

    if (lastPhase.current !== race.phase) {
      lastPhase.current = race.phase
    }

    // Lap timer: only 'driving' and 'arriving' count as driving. 'stopped'
    // and 'dry' are a card open (reading, not driving); 'warping' skips real
    // distance and would corrupt the figure if it ticked; 'lights' and
    // 'launching' are before lights-out, where the timer reads zero.
    if (race.phase === 'driving' || race.phase === 'arriving') {
      lapElapsed.current += delta * 1000
    }

    const fuelBeforeThisFrame = p.fuel
    let refueledThisFrame = false

    switch (race.phase) {
      case 'lights': {
        // The grid is idle, waiting for the first W. Only ever visited once:
        // every later lap reaches the grid already moving into 'launching'.
        p.v = 0
        if (wJustPressed) {
          useRaceStore.getState().setDriverSeen(true)
          launchElapsed.current = 0
          lapElapsed.current = 0
          useRaceStore.getState().setPhase('launching')
        }
        break
      }

      case 'launching': {
        // The 3-2-1 lights and the camera orbit run on their own timer here;
        // the car does not move until they finish. See ChaseCam.tsx for the
        // orbit and StartSequence.tsx for the lights themselves.
        p.v = 0
        launchElapsed.current += delta
        if (launchElapsed.current >= LAUNCH_DURATION) {
          launchElapsed.current = 0
          useRaceStore.getState().setPhase('driving')
        }
        break
      }

      case 'driving': {
        const stop = nextStopAfter(p.s)
        // Hand the sim a target only once the braking zone is actually in
        // reach, so free driving stays free. Never while reversing (Block F
        // invariant 1/2): a section stop fires only on a forward crossing,
        // and reverse-engagement itself already requires targetS === null,
        // so this is the React-side half of the same guard the sim enforces
        // on its own arrival snap.
        const gap = wrapS(stop.s - p.s)
        const arming = !p.reversing && gap <= stopDistance(p.v) + 2
        const cmd: CarInput = {
          throttle,
          brake,
          steer: (left ? 1 : 0) + (right ? -1 : 0),
          targetS: arming ? stop.s : null,
          steerEnabled: true,
          handbrake,
        }
        const { arrived } = stepCar(p, cmd, delta, track)
        if (arming) {
          // Dev assertion, Block F invariant 1: a section only ever arms on
          // a forward approach.
          if (import.meta.env.DEV && p.reversing && !warnedSectionReverse.current) {
            warnedSectionReverse.current = true
            console.error(`Car: section "${stop.id}" armed while reversing (invariant 1 violated)`)
          }
          useRaceStore.getState().setActiveSection(stop.id)
          useRaceStore.getState().setActiveItem(0)
          if (race.phase === 'driving') useRaceStore.getState().setPhase('arriving')
        }
        if (arrived) {
          if (import.meta.env.DEV && stop.kind === 'contact' && p.reversing && !warnedContactReverse.current) {
            warnedContactReverse.current = true
            console.error('Car: reached CONTACT while reversing (invariant 2 violated)')
          }
          useRaceStore
            .getState()
            .setPhase(stop.kind === 'contact' ? 'dry' : 'stopped')
        }
        break
      }

      case 'arriving': {
        const stop = race.activeSection ? sectionById(race.activeSection) : nextStopAfter(p.s)
        const cmd: CarInput = {
          throttle: false,
          brake: false,
          steer: 0,
          targetS: stop.s,
          // The limiter owns the car through the braking zone.
          steerEnabled: false,
          handbrake: false,
        }
        const { arrived } = stepCar(p, cmd, delta, track)
        if (arrived) {
          useRaceStore.getState().setPhase(stop.kind === 'contact' ? 'dry' : 'stopped')
        }
        break
      }

      case 'stopped': {
        p.v = 0
        if (wJustPressed) {
          useRaceStore.getState().setActiveSection(null)
          useRaceStore.getState().setPhase('driving')
        }
        break
      }

      case 'dry': {
        p.v = 0
        // W refuels immediately and starts the creep. The lap closes, but
        // nothing about it reads as a finish: no flag, no lap count.
        if (wJustPressed) {
          p.fuel = 1
          refueledThisFrame = true
          useRaceStore.getState().setActiveSection(null)
          useRaceStore.getState().setPhase('creeping')
        }
        break
      }

      case 'creeping': {
        // A short constant-speed roll from CONTACT to the grid slot, not a
        // full extra lap and not the driving model (no gears, no braking).
        // wrapS(0 - p.s) is exactly the forward distance to s=0.
        const remaining = wrapS(-p.s)
        const step = CREEP_SPEED * delta
        if (step >= remaining) {
          p.s = 0
          p.d = 0
          p.v = 0
          // Straight into the lights and orbit for lap 2. No second W: the
          // spec describes refuel, creep, lights and orbit as one flowing
          // sequence from the single W pressed at CONTACT.
          launchElapsed.current = 0
          lapElapsed.current = 0
          useRaceStore.getState().setPhase('launching')
        } else {
          p.s = wrapS(p.s + step)
          p.v = CREEP_SPEED
        }
        break
      }

      case 'warping': {
        const target = race.warpTarget
        if (!target) {
          useRaceStore.getState().setPhase('driving')
          break
        }
        // A warp is a forward teleport, never a continuation of reversing:
        // clear it here so the dashboard does not keep reading "R" for a car
        // that a moment ago got flown to a different part of the lap.
        if (p.reversing) {
          p.reversing = false
          p.reverseHoldTime = 0
        }
        const stop = sectionById(target.section)
        if (warp.current.target !== target) {
          // FORWARD ONLY around the loop. A car sliding backwards or sideways
          // at warp speed looks broken, and a closed loop always offers a
          // forward route to any target.
          warp.current = {
            target,
            from: p.s,
            to: p.s + wrapS(stop.s - p.s),
            elapsed: 0,
            progressAtStart: p.progress,
          }
        }
        warp.current.elapsed += delta
        const t = Math.min(1, warp.current.elapsed / WARP_DURATION)
        p.s = wrapS(
          warp.current.from + (warp.current.to - warp.current.from) * warpEase(t),
        )
        p.d = 0
        p.v = 0
        // Same fuel invariant as stepCar's, and for the same reason: `s`
        // wraps at the start/finish line, so a warp whose destination lies
        // on the far side of that wrap (recomputing fuel from raw `s`
        // instead of accumulated forward distance) briefly read as a full
        // refuel. `to - from` is always the real forward distance covered
        // (see the comment above), never wrapped, so progress can only rise
        // here -- exactly matching "however the lap was driven, skipped, or
        // jumped" from the fuel model's own governing rule.
        p.progress = Math.max(
          p.progress,
          warp.current.progressAtStart + (warp.current.to - warp.current.from) * warpEase(t),
        )
        p.fuel = Math.min(p.fuel, Math.max(0, Math.min(1, 1 - p.progress / TRACK_LENGTH)))
        useCarStore.getState().setWarpProgress(t)

        if (t >= 1) {
          warp.current.target = null
          useCarStore.getState().setWarpProgress(-1)
          p.s = stop.s
          const r = useRaceStore.getState()
          r.clearWarp()
          // A warp to the grid (the DRIVER section) lands stopped with its
          // card open, same as any other section, rather than replaying the
          // lights and orbit: those are a lap-boundary ceremony, not
          // something a mid-lap navbar detour should retrigger.
          r.setActiveSection(stop.kind === 'grid' ? 'driver' : stop.id)
          r.setActiveItem(target.item ?? 0)
          r.setPhase(stop.kind === 'contact' ? 'dry' : 'stopped')
        }
        break
      }
    }

    // Dev assertion, Block F invariant 3: fuel is monotonic outside an
    // explicit refuel. `stepCar` already enforces this with its own
    // `Math.min` guard, so this only ever fires if something bypasses
    // `stepCar` and writes `p.fuel` directly.
    if (import.meta.env.DEV && !refueledThisFrame && !warnedFuelRose.current) {
      if (p.fuel > fuelBeforeThisFrame + 1e-6) {
        warnedFuelRose.current = true
        console.error(
          `Car: fuel rose from ${fuelBeforeThisFrame.toFixed(4)} to ${p.fuel.toFixed(4)} without a refuel (invariant 3 violated)`,
        )
      }
    }

    // Warp speed is orders of magnitude above driving speed, and publishing it
    // would drive the camera feed-forward off the end of the track.
    useCarStore.getState().set({
      s: p.s,
      d: p.d,
      v: race.phase === 'warping' ? 0 : p.v,
      gear: p.gear,
      rpm: p.rpm,
      fuel: p.fuel,
      braking: p.braking,
      slipAngle: p.slipAngle,
      drifting: p.drifting,
      driftScore: p.driftScore,
      lapElapsedMs: lapElapsed.current,
      reversing: p.reversing,
      throttleInput: throttle,
    })

    // --- place the car ---

    const fr = frameAt(p.s)
    group.current.position.set(fr.x + fr.lx * p.d, 0, fr.z + fr.lz * p.d)

    // The model faces +Z, so the tangent heading is a direct Y rotation. The
    // small `-p.roll * 0.06` nudge is cosmetic, present even outside a drift,
    // to sell a car changing line rather than sliding. `p.slipAngle` is the
    // real thing: body yaw is tangent heading plus slip angle, per the brief.
    const heading = Math.atan2(fr.tx, fr.tz)
    const slipRad = (p.slipAngle * Math.PI) / 180
    group.current.rotation.set(
      p.pitch * PITCH_MAX,
      heading - p.roll * 0.06 + slipRad,
      p.roll * ROLL_MAX,
    )

    const yaw = p.roll * WHEEL_YAW_MAX
    spinQuat.setFromAxisAngle(SPIN_AXIS, p.wheelAngle)
    steerQuat.setFromAxisAngle(STEER_AXIS, yaw)

    for (const wheel of wheels.rear) {
      wheel.quaternion.copy(restQuat(wheel)).premultiply(spinQuat)
    }
    for (const wheel of wheels.front) {
      // Steer outside the spin, so the wheel rolls about its steered axle.
      wheel.quaternion.copy(restQuat(wheel)).premultiply(spinQuat).premultiply(steerQuat)
    }

    // Brake lights. No dedicated node in the GLB (see spec 1.3's material
    // list), so two small emissive planes stand in at the rear, toggled by
    // the same `braking` flag the sim already tracks for the auto-stop and
    // the manual S key alike.
    const lit = p.braking ? 1 : 0
    const matL = brakeLightL.current?.material as THREE.MeshStandardMaterial | undefined
    const matR = brakeLightR.current?.material as THREE.MeshStandardMaterial | undefined
    if (matL) matL.emissiveIntensity = lit
    if (matR) matR.emissiveIntensity = lit
  }, -1)

  return (
    <group ref={group} scale={CAR_SCALE}>
      <primitive object={scene} />
      {/* Local (pre-scale) space: rear of the car is about z=-3.69 (the
          -2.58 world bound in ChaseCam's comment, divided back out by
          CAR_SCALE). Positioned outside the wheel arches, bumper height. */}
      <mesh ref={brakeLightL} position={[-0.9, 1.1, -3.65]}>
        <planeGeometry args={[0.35, 0.18]} />
        <meshStandardMaterial
          color="#1a0000"
          emissive="#ff1414"
          emissiveIntensity={0}
          roughness={0.6}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={brakeLightR} position={[0.9, 1.1, -3.65]}>
        <planeGeometry args={[0.35, 0.18]} />
        <meshStandardMaterial
          color="#1a0000"
          emissive="#ff1414"
          emissiveIntensity={0}
          roughness={0.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

useGLTF.preload('/models/car.glb')
