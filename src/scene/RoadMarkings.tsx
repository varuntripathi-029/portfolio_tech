import { useMemo } from 'react'
import * as THREE from 'three'
import { makeStartingGridTexture } from './markingsTexture'
import { buildRibbon } from './ribbon'
import { frameAt } from '../track/trackFrame'
import { TRACK_HALF } from './trackLayout'

/** Just inside the kerb, which starts at 6m. */
const LANE_LINE_D = TRACK_HALF - 0.15
const LANE_LINE_WIDTH = 0.15
const GRID_LENGTH = 40

const PAINT_Y = 0.0012
const GRID_Y = 0.0016

/**
 * Painted lines are matte white. Anything glossier picks up the bright sunset
 * sky as a specular glare and washes out, the same problem the LED boards had.
 */
function usePaint(color = '#f2f2f0') {
  return useMemo(
    () => new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 }),
    [color],
  )
}

/** One continuous edge line per side, swept along the curve. */
function LaneLines() {
  const material = usePaint()
  const geometries = useMemo(
    () =>
      [1, -1].map((side) =>
        buildRibbon({
          from: side * (LANE_LINE_D - LANE_LINE_WIDTH / 2),
          to: side * (LANE_LINE_D + LANE_LINE_WIDTH / 2),
          y: PAINT_Y,
          // A solid line, so the tile only has to avoid a visible wrap.
          tile: 8,
          step: 2,
        }),
      ),
    [],
  )

  return (
    <>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={material} raycast={() => null} />
      ))}
    </>
  )
}

/**
 * Start/finish line and the grid boxes, both flat quads at s = 0.
 *
 * A flat quad is only valid because the line sits on the main straight, with
 * over 200m of straight either side of it. Nothing else in the scene may
 * assume that.
 */
function StartFinish() {
  const material = usePaint()
  const frame = useMemo(() => {
    const fr = frameAt(0)
    return {
      x: fr.x,
      z: fr.z,
      heading: Math.atan2(fr.tx, fr.tz),
    }
  }, [])

  const lineGeometry = useMemo(() => new THREE.PlaneGeometry(TRACK_HALF * 2, 0.7), [])
  const gridTexture = useMemo(
    () => makeStartingGridTexture(TRACK_HALF * 2, GRID_LENGTH),
    [],
  )
  const gridMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: gridTexture,
        transparent: true,
        roughness: 1,
        metalness: 0,
      }),
    [gridTexture],
  )
  const gridGeometry = useMemo(
    () => new THREE.PlaneGeometry(TRACK_HALF * 2, GRID_LENGTH),
    [],
  )

  return (
    <group position={[frame.x, 0, frame.z]} rotation-y={frame.heading}>
      <mesh
        geometry={lineGeometry}
        material={material}
        rotation-x={-Math.PI / 2}
        raycast={() => null}
      />
      {/* The grid sits behind the line, so the car starts on it and crosses. */}
      <mesh
        geometry={gridGeometry}
        material={gridMaterial}
        rotation-x={-Math.PI / 2}
        position={[0, GRID_Y, -GRID_LENGTH / 2 - 1]}
        raycast={() => null}
      />
    </group>
  )
}

export function RoadMarkings() {
  return (
    <>
      <LaneLines />
      <StartFinish />
    </>
  )
}
