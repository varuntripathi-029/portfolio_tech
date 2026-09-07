import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useCarStore } from '../state/carStore'
import { TRACK_LENGTH } from './trackLayout'

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

function useDriveInput() {
  const input = useRef({ forward: false, brake: false })

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W') input.current.forward = true
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
  const speedRef = useRef(0)

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

  useFrame((_, rawDelta) => {
    // The frame clock keeps running during the async GLTF load, so the
    // first frame after Suspense resolves can report a multi-second delta.
    // Clamp it or that one frame launches the car hundreds of metres.
    const delta = Math.min(rawDelta, 1 / 30)
    const { forward, brake } = input.current
    let speed = speedRef.current

    if (forward) speed += ACCEL * delta
    else if (brake) speed -= BRAKE_DECEL * delta
    else speed -= COAST_DECEL * delta

    speed = THREE.MathUtils.clamp(speed, 0, MAX_SPEED)
    speedRef.current = speed

    const nextZ = THREE.MathUtils.clamp(useCarStore.getState().z + speed * delta, 0, TRACK_LENGTH)
    useCarStore.getState().set(nextZ, speed)

    group.current.position.z = nextZ

    const wheelSpin = (speed / (WHEEL_RADIUS * CAR_SCALE)) * delta
    const rearWheels = nodes['tires.003']
    const frontLeft = nodes['tires.002']
    const frontRight = nodes['tires.001']
    if (rearWheels) rearWheels.rotation.x += wheelSpin
    if (frontLeft) frontLeft.rotation.x += wheelSpin
    if (frontRight) frontRight.rotation.x += wheelSpin
  })

  return (
    <group ref={group} scale={CAR_SCALE}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/models/car.glb')
