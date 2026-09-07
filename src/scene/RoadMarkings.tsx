import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_LENGTH, PIT_LANE } from './trackLayout'
import { makeStartingGridTexture } from './markingsTexture'

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
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(LANE_LINE_WIDTH, TRACK_LENGTH),
    [],
  )

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

/** Short angled yellow strips where the pit lane splits from the racing line. */
function PitLaneMerge() {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffd500', roughness: 1 }),
    [],
  )
  const geometry = useMemo(() => new THREE.PlaneGeometry(0.15, 4), [])

  return (
    <>
      {/* Entry: peels off the racing line into the pit lane band. */}
      <mesh
        geometry={geometry}
        material={material}
        rotation-x={-Math.PI / 2}
        rotation-z={PIT_LANE.side * -0.35}
        position={[PIT_LANE.side * 6.6, 0.003, PIT_LANE.zStart - 5]}
        raycast={() => null}
      />
      {/* Exit: rejoins the racing line. */}
      <mesh
        geometry={geometry}
        material={material}
        rotation-x={-Math.PI / 2}
        rotation-z={PIT_LANE.side * 0.35}
        position={[PIT_LANE.side * 6.6, 0.003, PIT_LANE.zEnd + 5]}
        raycast={() => null}
      />
    </>
  )
}

/**
 * The pit lane surface itself: a short stretch of asphalt_pit_lane inside
 * the runoff band. No event data exists yet to place real pit stops (phase
 * 4), so this is one fixed placeholder strip that shows the surface change.
 */
function PitLaneSurface() {
  const gl = useThree((s) => s.gl)
  const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
  const width = PIT_LANE.outer - PIT_LANE.inner
  const length = PIT_LANE.zEnd - PIT_LANE.zStart
  const x = PIT_LANE.side * (PIT_LANE.inner + width / 2)
  const z = PIT_LANE.zStart + length / 2

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

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation-x={-Math.PI / 2}
      position={[x, PIT_LANE.y, z]}
      raycast={() => null}
    />
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
