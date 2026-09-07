import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCarStore } from '../state/carStore'

/**
 * Measured by decoding the HDRI directly (azimuth 36.0deg off +Z, elevation
 * 6.2deg), not estimated. The environment is left unrotated: rotating it
 * separately from this light would desync the visible sun from the shadow
 * it casts.
 */
const SUN_DIRECTION = new THREE.Vector3(0.804, 0.1072, 0.5849)
const LIGHT_DISTANCE = 30

// A 6.2deg sun throws a shadow roughly 9x the caster's height, so the
// frustum needs generous lateral room even though the car itself is small.
const SHADOW_EXTENT = 16

/**
 * Only shadow-casting light in the scene. The frustum is finite, so both
 * the light and its target are re-centred on the car every frame, keeping
 * their offset constant, or the shadow falls out of range within seconds.
 */
export function Lighting() {
  const light = useRef<THREE.DirectionalLight>(null!)
  const target = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    light.current.target = target
  }, [target])

  useFrame(() => {
    const z = useCarStore.getState().z
    light.current.position.set(
      SUN_DIRECTION.x * LIGHT_DISTANCE,
      SUN_DIRECTION.y * LIGHT_DISTANCE,
      z + SUN_DIRECTION.z * LIGHT_DISTANCE,
    )
    target.position.set(0, 0, z)
    // The target lives outside the scene graph, so it needs its own matrix
    // refresh; the renderer only auto-updates objects it owns.
    target.updateMatrixWorld()
  })

  return (
    <directionalLight
      ref={light}
      intensity={6}
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-SHADOW_EXTENT}
      shadow-camera-right={SHADOW_EXTENT}
      shadow-camera-top={SHADOW_EXTENT}
      shadow-camera-bottom={-SHADOW_EXTENT}
      shadow-camera-near={1}
      shadow-camera-far={70}
      shadow-bias={-0.0015}
    />
  )
}
