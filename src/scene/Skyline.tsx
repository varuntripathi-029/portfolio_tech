import { useLayoutEffect, useMemo } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { OUTSIDE_SIGN, frameAt, pointInLoop, TRACK_LENGTH } from '../track/trackFrame'
import { BARRIER_X } from './trackLayout'

/**
 * The background city, per spec 1.7/5.5. Outside the loop only: on the
 * inside of a bend a large-offset prop lands on another part of the track,
 * which is not a tuning issue but a geometric certainty on a non-convex
 * circuit, so every placement here is confirmed with `pointInLoop` (the same
 * winding-number side test the props' own clearance assertion uses for
 * anything offset more than 20m) rather than trusting `OUTSIDE_SIGN` alone.
 */

/** Measured, do not re-derive (spec 1.7). */
const SKYLINE_BASE_OFFSET_Y = 143

/**
 * Scale picked inside the spec's own two, only partially reconciled,
 * guidelines: "recommended scale 0.3 to 0.5" (to tame a 172m-tall source
 * next to a 17m track) against "scale X 1.5 to 2x so a copy spans 300 to
 * 400m" (to cover more ground per copy and hold the triangle budget). The
 * two do not compose to exactly 300-400m at 0.3-0.5 base, so this picks the
 * middle of both ranges rather than re-deriving a number the spec itself
 * does not pin down: Y/Z at 0.4 (about 69m tall, reads as a skyline next to
 * the car without dwarfing the foreground), X stretched an extra 1.75x on
 * top of that for width.
 */
const SCALE_Y = 0.4
const SCALE_X = SCALE_Y * 1.75

const SKYLINE_D = OUTSIDE_SIGN * (BARRIER_X + 180)
const SILHOUETTE_D = OUTSIDE_SIGN * (BARRIER_X + 420)
const COPY_COUNT = 10
const SILHOUETTE_COUNT = 6

interface Placement {
  s: number
  x: number
  z: number
  /** Tangent-facing yaw, for cluster variety: which way a building faces
   * barely matters at this distance. */
  yaw: number
  /** -left, per billboardGeometry's facing-vector convention (spec 5.5):
   * "something read by an approaching car" gets -tangent, "a trackside
   * board read from the track" gets -left. A backdrop is read from the
   * track, so its face turns to look back at it. */
  facingYaw: number
}

/** Evenly spaced around the loop, filtered to genuinely-outside positions
 * only: near the concave notch a naive offset can land back inside. */
function outsidePlacements(count: number, d: number): Placement[] {
  const out: Placement[] = []
  for (let i = 0; i < count; i++) {
    const s = (TRACK_LENGTH * i) / count
    const fr = frameAt(s)
    const x = fr.x + fr.lx * d
    const z = fr.z + fr.lz * d
    if (pointInLoop(x, z)) continue // the side test: skip, do not mirror
    out.push({
      s,
      x,
      z,
      yaw: Math.atan2(fr.tx, fr.tz),
      facingYaw: Math.atan2(-fr.lx, -fr.lz),
    })
  }
  return out
}

function SkylineCluster() {
  const { scene } = useGLTF('/models/skyline.glb')

  const prepared = useMemo(() => {
    const cloned = scene.clone(true)
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const material = child.material as THREE.MeshStandardMaterial
      // The source is a night model (emissiveFactor [1,1,1]); left alone it
      // glows white against the sunset. It is a background silhouette.
      material.emissive.setScalar(0)
      material.emissiveIntensity = 0
      material.side = THREE.FrontSide
      child.castShadow = false
      child.receiveShadow = false
    })
    return cloned
  }, [scene])

  const placements = useMemo(() => outsidePlacements(COPY_COUNT, SKYLINE_D), [])

  return (
    <>
      {placements.map((p, i) => (
        <primitive
          key={i}
          object={i === 0 ? prepared : prepared.clone(true)}
          position={[p.x, SKYLINE_BASE_OFFSET_Y * SCALE_Y, p.z]}
          rotation={[0, p.yaw, 0]}
          scale={[SCALE_X, SCALE_Y, SCALE_Y]}
        />
      ))}
    </>
  )
}

/** A big flat wall of the keyed silhouette image, further out than the GLB
 * clusters, filling the gaps a real city is never continuous, per 1.7. */
function FarSilhouette() {
  const texture = useTexture('/scenery/skyline_1024.png')
  const material = useMemo(() => {
    // Edges do not match: MirroredRepeatWrapping on S avoids a visible seam
    // every tile (spec 1.7's own note on this exact asset).
    texture.wrapS = THREE.MirroredRepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }, [texture])

  const placements = useMemo(() => outsidePlacements(SILHOUETTE_COUNT, SILHOUETTE_D), [])
  const WIDTH = 500
  const HEIGHT = 90

  return (
    <>
      {placements.map((p, i) => (
        <mesh
          key={i}
          position={[p.x, HEIGHT / 2, p.z]}
          rotation={[0, p.facingYaw, 0]}
          material={material}
          raycast={() => null}
        >
          <planeGeometry args={[WIDTH, HEIGHT]} />
        </mesh>
      ))}
    </>
  )
}

export function Skyline() {
  return (
    <group>
      <SkylineCluster />
      <FarSilhouette />
    </group>
  )
}

useGLTF.preload('/models/skyline.glb')
