import { useLayoutEffect, useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_LENGTH, PIT_LANE, PIT_ENTRY_LEAD, PIT_EXIT_LEAD } from './trackLayout'
import { makeStartingGridTexture } from './markingsTexture'
import { TIMELINE } from '../data/timeline'

const TRACK_WIDTH = 12 // full track band, x -6..6
const LANE_LINE_X = 5.85 // just inside the kerb (kerb starts at x=6)
const LANE_LINE_WIDTH = 0.15
const GRID_LENGTH = 40

/** One flat white strip per side, no per-dash meshes. */
function LaneLines() {
  const material = useMemo(
    // Fully matte: the bright sunset sky's specular washes lower roughness
    // paint out to a pale glare (same issue found on the LED boards).
    () => new THREE.MeshStandardMaterial({ color: '#f2f2f0', roughness: 1 }),
    [],
  )
  const geometry = useMemo(() => new THREE.PlaneGeometry(LANE_LINE_WIDTH, TRACK_LENGTH), [])

  return (
    <>
      <mesh
        geometry={geometry}
        material={material}
        rotation-x={-Math.PI / 2}
        position={[LANE_LINE_X, 0.001, TRACK_LENGTH / 2]}
        raycast={() => null}
      />
      <mesh
        geometry={geometry}
        material={material}
        rotation-x={-Math.PI / 2}
        position={[-LANE_LINE_X, 0.001, TRACK_LENGTH / 2]}
        raycast={() => null}
      />
    </>
  )
}

/** Staggered box markers painted over the track near the start. */
function StartingGrid() {
  const texture = useMemo(() => makeStartingGridTexture(TRACK_WIDTH, GRID_LENGTH), [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 1 }),
    [texture],
  )
  const geometry = useMemo(() => new THREE.PlaneGeometry(TRACK_WIDTH, GRID_LENGTH), [])

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation-x={-Math.PI / 2}
      position={[0, 0.0015, GRID_LENGTH / 2]}
      raycast={() => null}
    />
  )
}

/** Short angled yellow strips where the pit lane splits, one pair per event. */
function PitLaneMerge() {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd500', roughness: 1 }), [])
  const geometry = useMemo(() => new THREE.PlaneGeometry(0.15, 4), [])
  const ref = useRef<THREE.InstancedMesh>(null!)

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    let i = 0
    for (const event of TIMELINE) {
      // Entry: peels off the racing line into the pit lane band.
      dummy.rotation.set(-Math.PI / 2, 0, PIT_LANE.side * -0.35)
      dummy.position.set(PIT_LANE.side * 6.6, 0.003, event.trackZ - PIT_ENTRY_LEAD + 5)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i++, dummy.matrix)

      // Exit: rejoins the racing line.
      dummy.rotation.set(-Math.PI / 2, 0, PIT_LANE.side * 0.35)
      dummy.position.set(PIT_LANE.side * 6.6, 0.003, event.trackZ + PIT_EXIT_LEAD - 5)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i++, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <instancedMesh ref={ref} args={[geometry, material, TIMELINE.length * 2]} raycast={() => null} />
  )
}

/**
 * The pit lane surface: one asphalt_pit_lane bay per timeline event, all
 * sharing one geometry and material since every bay is the same size.
 */
function PitLaneSurface() {
  const gl = useThree((s) => s.gl)
  const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
  const width = PIT_LANE.outer - PIT_LANE.inner
  const length = PIT_ENTRY_LEAD + PIT_EXIT_LEAD
  const x = PIT_LANE.side * (PIT_LANE.inner + width / 2)

  const { diff, nor, arm } = useTexture({
    diff: `/textures/${PIT_LANE.dir}/diff.jpg`,
    nor: `/textures/${PIT_LANE.dir}/nor_gl.jpg`,
    arm: `/textures/${PIT_LANE.dir}/arm.jpg`,
  })

  const geometry = useMemo(() => new THREE.PlaneGeometry(width, length), [width, length])

  const material = useMemo(() => {
    const repeatX = width / PIT_LANE.tile
    const repeatY = length / PIT_LANE.tile
    for (const tex of [diff, nor, arm]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(repeatX, repeatY)
      tex.anisotropy = anisotropy
    }
    diff.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({
      map: diff,
      normalMap: nor,
      aoMap: arm,
      roughnessMap: arm,
      metalnessMap: arm,
      roughness: 1,
      metalness: 1,
    })
  }, [diff, nor, arm, width, length, anisotropy])

  const ref = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    dummy.rotation.x = -Math.PI / 2
    TIMELINE.forEach((event, i) => {
      const z = event.trackZ + (PIT_EXIT_LEAD - PIT_ENTRY_LEAD) / 2
      dummy.position.set(x, PIT_LANE.y, z)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [x])

  return (
    <instancedMesh ref={ref} args={[geometry, material, TIMELINE.length]} raycast={() => null} />
  )
}

export function RoadMarkings() {
  return (
    <>
      <LaneLines />
      <StartingGrid />
      <PitLaneSurface />
      <PitLaneMerge />
    </>
  )
}
