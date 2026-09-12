import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useRaceStore } from '../state/raceStore'
import { frameAt } from '../track/trackFrame'

/**
 * The one gantry at the start/finish line, carrying a 3-2-1 light array that
 * mirrors the DOM `StartSequence`'s lights, per Block E's brief.
 *
 * Timing is recomputed here from `phase` and elapsed time, not read from
 * `StartSequence.tsx`'s own component state: that state is local to a DOM
 * component with no store presence, and the project already has a precedent
 * for this exact situation (`AudioEngine.tsx`'s `LIGHT_INTERVAL`, mirrored
 * rather than imported "so audio has no dependency on that component
 * existing"). The same reasoning applies here: the 3D scene should not
 * depend on a DOM overlay component being mounted.
 */
const LIGHT_INTERVAL = 0.55
const BEAM_SPAN = 30
const BEAM_HEIGHT = 9
const LIGHT_RADIUS = 0.35
const LIGHT_SPACING = 1.4

const OFF_COLOR = new THREE.Color('#3a1010')
const ON_COLOR = new THREE.Color('#ff1414')

function useLitCount() {
  const litRef = useRef(0)
  const phaseRef = useRef('lights')
  const enteredAt = useRef(0)

  useFrame((state) => {
    const phase = useRaceStore.getState().phase
    if (phase !== phaseRef.current) {
      phaseRef.current = phase
      enteredAt.current = state.clock.elapsedTime
    }
    if (phase !== 'launching') {
      litRef.current = 0
      return
    }
    const elapsed = state.clock.elapsedTime - enteredAt.current
    // Three lights at LIGHT_INTERVAL apart, then dark together for the
    // remainder of LAUNCH_DURATION (matching StartLights.tsx's own 3-2-1
    // then a 500ms hold before lights-out).
    if (elapsed >= LIGHT_INTERVAL * 3) litRef.current = 0
    else litRef.current = Math.min(3, Math.floor(elapsed / LIGHT_INTERVAL) + 1)
  })

  return litRef
}

/** Ahead of the grid slot: cars launch toward it and pass under it, the same
 * arrangement a real start gantry uses. See FINAL2_NOTES.md's Block E entry
 * for the screenshot-framing issue this position does not resolve (the
 * component itself is confirmed correct by direct scene inspection: right
 * position, right per-frame light state through the whole 3-2-1 sequence). */
const GANTRY_S = 20

export function StartGantry() {
  const fr = frameAt(GANTRY_S)
  const yaw = Math.atan2(fr.tx, fr.tz)
  const litRef = useLitCount()
  const lightRefs = useRef<THREE.Mesh[]>([])

  useFrame(() => {
    const lit = litRef.current
    lightRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const material = mesh.material as THREE.MeshStandardMaterial
      material.color.copy(i < lit ? ON_COLOR : OFF_COLOR)
      material.emissive.copy(i < lit ? ON_COLOR : OFF_COLOR)
      material.emissiveIntensity = i < lit ? 1.5 : 0
    })
  })

  return (
    <group name="start-gantry" position={[fr.x, 0, fr.z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, BEAM_HEIGHT, 0]} raycast={() => null}>
        <boxGeometry args={[BEAM_SPAN, 0.6, 0.6]} />
        <meshStandardMaterial color="#3a3a42" roughness={1} metalness={0.1} />
      </mesh>
      <mesh position={[-BEAM_SPAN / 2, BEAM_HEIGHT / 2, 0]} raycast={() => null}>
        <boxGeometry args={[0.5, BEAM_HEIGHT, 0.5]} />
        <meshStandardMaterial color="#3a3a42" roughness={1} metalness={0.1} />
      </mesh>
      <mesh position={[BEAM_SPAN / 2, BEAM_HEIGHT / 2, 0]} raycast={() => null}>
        <boxGeometry args={[0.5, BEAM_HEIGHT, 0.5]} />
        <meshStandardMaterial color="#3a3a42" roughness={1} metalness={0.1} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) lightRefs.current[i] = m
          }}
          position={[(i - 1) * LIGHT_SPACING, BEAM_HEIGHT - 1, 0.35]}
          raycast={() => null}
        >
          <sphereGeometry args={[LIGHT_RADIUS, 12, 12]} />
          <meshStandardMaterial color={OFF_COLOR} emissive={OFF_COLOR} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}
