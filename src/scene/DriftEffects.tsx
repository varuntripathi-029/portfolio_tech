import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCarStore } from '../state/carStore'
import { useRaceStore } from '../state/raceStore'
import { frameAt } from '../track/trackFrame'
import { WHEEL_HALF_TRACK, REAR_WHEEL_Z } from '../sim/carSpec'
import { makeSoftDotTexture } from './smokeTexture'

/**
 * Rear-wheel drift visuals: pooled tyre smoke and two fading skid-mark
 * ribbons. Both read the car's published position/rotation from the store
 * and recompute the rear axle world position independently rather than
 * reaching into Car.tsx's internals, the same store-mediated separation
 * every other scene component already uses.
 *
 * Default priority (0) is safe here: Car.tsx runs at -1 and this only reads
 * what Car.tsx already wrote this frame, never the reverse (KNOWN TRAPS #1).
 *
 * First thing to cut under load, per the brief: `EFFECTS_ENABLED` (set by
 * Scene.tsx from the touch/quality probe) skips both entirely.
 */

const MAX_PARTICLES = 48
const PARTICLE_LIFE = 0.9
const SMOKE_SIZE = 1.4

const MAX_SKID_SAMPLES = 300
const SKID_WIDTH = 0.16
const SKID_MAX_AGE = 8

function rearWheelWorld(
  out: THREE.Vector3,
  side: 1 | -1,
  carX: number,
  carZ: number,
  yaw: number,
) {
  const localX = side * WHEEL_HALF_TRACK
  const localZ = REAR_WHEEL_Z
  const sinY = Math.sin(yaw)
  const cosY = Math.cos(yaw)
  out.set(carX + localX * cosY + localZ * sinY, 0.05, carZ - localX * sinY + localZ * cosY)
}

function useSmoke(scale: number) {
  const texture = useMemo(() => makeSoftDotTexture(), [])
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3))
    return g
  }, [])
  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: texture,
        size: SMOKE_SIZE * scale,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
      }),
    [texture, scale],
  )

  const particles = useRef(
    Array.from({ length: MAX_PARTICLES }, () => ({
      x: 0,
      y: -1000,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: PARTICLE_LIFE,
    })),
  )
  const cursor = useRef(0)

  function spawn(x: number, y: number, z: number) {
    const p = particles.current[cursor.current]
    cursor.current = (cursor.current + 1) % MAX_PARTICLES
    p.x = x
    p.y = y
    p.z = z
    p.vx = (Math.random() - 0.5) * 0.6
    p.vy = 0.4 + Math.random() * 0.3
    p.vz = (Math.random() - 0.5) * 0.6
    p.age = 0
  }

  function tick(delta: number) {
    const pos = geometry.attributes.position as THREE.BufferAttribute
    const col = geometry.attributes.color as THREE.BufferAttribute
    particles.current.forEach((p, i) => {
      if (p.age < PARTICLE_LIFE) {
        p.age += delta
        p.x += p.vx * delta
        p.y += p.vy * delta
        p.z += p.vz * delta
      }
      const fade = Math.max(0, 1 - p.age / PARTICLE_LIFE)
      pos.setXYZ(i, p.x, p.y, p.z)
      col.setXYZ(i, fade * 0.6, fade * 0.6, fade * 0.6)
    })
    pos.needsUpdate = true
    col.needsUpdate = true
  }

  return { geometry, material, spawn, tick }
}

function useSkidRibbon() {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(MAX_SKID_SAMPLES * 2 * 3), 3),
    )
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_SKID_SAMPLES * 2 * 3), 3))
    const indices: number[] = []
    for (let i = 0; i < MAX_SKID_SAMPLES - 1; i++) {
      const a = i * 2
      const b = i * 2 + 1
      const c = i * 2 + 2
      const d = i * 2 + 3
      indices.push(a, b, c, b, d, c)
    }
    g.setIndex(indices)
    g.setDrawRange(0, 0)
    return g
  }, [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )

  const samples = useRef<{ x: number; z: number; perpX: number; perpZ: number; age: number }[]>([])

  function record(x: number, z: number, perpX: number, perpZ: number) {
    samples.current.push({ x, z, perpX, perpZ, age: 0 })
    if (samples.current.length > MAX_SKID_SAMPLES) samples.current.shift()
  }

  function tick(delta: number) {
    const list = samples.current
    for (const s of list) s.age += delta
    while (list.length > 0 && list[0].age > SKID_MAX_AGE) list.shift()

    const pos = geometry.attributes.position as THREE.BufferAttribute
    const col = geometry.attributes.color as THREE.BufferAttribute
    list.forEach((s, i) => {
      const alpha = Math.max(0, 1 - s.age / SKID_MAX_AGE)
      const hw = SKID_WIDTH * alpha
      pos.setXYZ(i * 2, s.x + s.perpX * hw, 0.015, s.z + s.perpZ * hw)
      pos.setXYZ(i * 2 + 1, s.x - s.perpX * hw, 0.015, s.z - s.perpZ * hw)
      const shade = 0.05 * alpha
      col.setXYZ(i * 2, shade, shade, shade)
      col.setXYZ(i * 2 + 1, shade, shade, shade)
    })
    pos.needsUpdate = true
    col.needsUpdate = true
    geometry.setDrawRange(0, Math.max(0, (list.length - 1) * 6))
  }

  return { geometry, material, record, tick }
}

const carPos = new THREE.Vector3()
const leftWheel = new THREE.Vector3()
const rightWheel = new THREE.Vector3()

export function DriftEffects({ enabled = true }: { enabled?: boolean }) {
  const smoke = useSmoke(1)
  const skidL = useSkidRibbon()
  const skidR = useSkidRibbon()
  const spawnAccum = useRef(0)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30)
    if (!enabled) return

    const { s, d, slipAngle, drifting } = useCarStore.getState()
    const phase = useRaceStore.getState().phase
    const active = drifting && (phase === 'driving' || phase === 'arriving')

    const fr = frameAt(s)
    carPos.set(fr.x + fr.lx * d, 0, fr.z + fr.lz * d)
    const yaw = Math.atan2(fr.tx, fr.tz) + (slipAngle * Math.PI) / 180

    rearWheelWorld(leftWheel, 1, carPos.x, carPos.z, yaw)
    rearWheelWorld(rightWheel, -1, carPos.x, carPos.z, yaw)

    if (active) {
      spawnAccum.current += delta
      const spawnInterval = 1 / 30
      while (spawnAccum.current >= spawnInterval) {
        spawnAccum.current -= spawnInterval
        smoke.spawn(leftWheel.x, leftWheel.y, leftWheel.z)
        smoke.spawn(rightWheel.x, rightWheel.y, rightWheel.z)
      }
      // Perpendicular to the car's own heading, which is close enough to the
      // wheel's own rolling direction for a thin cosmetic mark.
      const perpX = fr.lx
      const perpZ = fr.lz
      skidL.record(leftWheel.x, leftWheel.z, perpX, perpZ)
      skidR.record(rightWheel.x, rightWheel.z, perpX, perpZ)
    } else {
      spawnAccum.current = 0
    }

    smoke.tick(delta)
    skidL.tick(delta)
    skidR.tick(delta)
  })

  return (
    <>
      <points geometry={smoke.geometry} material={smoke.material} frustumCulled={false} />
      <mesh geometry={skidL.geometry} material={skidL.material} raycast={() => null} frustumCulled={false} />
      <mesh geometry={skidR.geometry} material={skidR.material} raycast={() => null} frustumCulled={false} />
    </>
  )
}
