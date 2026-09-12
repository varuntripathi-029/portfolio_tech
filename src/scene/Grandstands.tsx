import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GRANDSTANDS } from '../track/props'
import { frameAt } from '../track/trackFrame'

const BASE_WIDTH = 20
const BASE_DEPTH = 8
const STEPS = 4
const STEP_HEIGHT = 1.5

/** Raised so the crowd clears the guardrail line at the 17m grass band edge,
 * per spec 1.7: "or the lower tiers hide behind the barrier". */
const CROWD_RAISE = 0.6
const CROWD_WIDTH = BASE_WIDTH - 2
const CROWD_HEIGHT = STEPS * STEP_HEIGHT + 1

function buildGrandstandGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (let s = 0; s < STEPS; s++) {
    const width = BASE_WIDTH - s * 3
    const depth = BASE_DEPTH - s * 1.2
    const box = new THREE.BoxGeometry(width, STEP_HEIGHT, depth)
    // Tiers rise going away from the track, so the stand faces the racing line.
    box.translate(0, STEP_HEIGHT / 2 + s * STEP_HEIGHT, s * 1.2)
    parts.push(box)
  }
  return mergeGeometries(parts)
}

/** One quad, positioned at the back/top of the tiers so it reads as the
 * crowd rising behind the steps rather than replacing them. */
function buildCrowdGeometry(): THREE.BufferGeometry {
  const plane = new THREE.PlaneGeometry(CROWD_WIDTH, CROWD_HEIGHT)
  plane.translate(0, CROWD_HEIGHT / 2 + CROWD_RAISE, (STEPS - 1) * 1.2)
  return plane
}

/**
 * Blocky stepped silhouettes, plus a tiled crowd texture riding the same
 * instance transforms as a second InstancedMesh (one extra draw call total,
 * not one per stand). No seats, no people modelled, per the audience
 * rejection note in spec 1.7: the tiled texture is the crowd.
 *
 * OUTSIDE the loop only, which props.ts enforces by deriving the lateral offset
 * from the winding rather than mirroring it. At this distance from the
 * centreline an inside placement lands on another part of the circuit, and the
 * clearance assertion would catch it.
 */
export function Grandstands() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const crowdRef = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(buildGrandstandGeometry, [])
  const crowdGeometry = useMemo(buildCrowdGeometry, [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#555a63', roughness: 1 }),
    [],
  )

  const crowdTexture = useTexture('/scenery/crowd_512.jpg')
  const crowdMaterial = useMemo(() => {
    crowdTexture.wrapS = crowdTexture.wrapT = THREE.RepeatWrapping
    crowdTexture.repeat.set(CROWD_WIDTH / 6, CROWD_HEIGHT / 6)
    crowdTexture.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({
      map: crowdTexture,
      roughness: 1,
      side: THREE.DoubleSide,
    })
  }, [crowdTexture])

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    GRANDSTANDS.forEach((p, i) => {
      const fr = frameAt(p.s)
      dummy.position.set(fr.x + fr.lx * p.d, 0, fr.z + fr.lz * p.d)
      // Width runs along the track, so the long face looks at the racing line.
      dummy.rotation.set(0, Math.atan2(fr.tx, fr.tz), 0)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
      crowdRef.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
    crowdRef.current.instanceMatrix.needsUpdate = true
  }, [])

  // Cheap aliveness: nudging the texture offset a fraction of a pixel every
  // few frames reads as a crowd shimmering, not a static poster (spec 1.7).
  const frameCount = useRef(0)
  useFrame((state) => {
    frameCount.current += 1
    if (frameCount.current % 6 !== 0) return
    crowdTexture.offset.x = Math.sin(state.clock.elapsedTime * 0.6) * 0.003
  })

  return (
    <>
      <instancedMesh ref={ref} args={[geometry, material, GRANDSTANDS.length]} raycast={() => null} />
      <instancedMesh
        ref={crowdRef}
        args={[crowdGeometry, crowdMaterial, GRANDSTANDS.length]}
        raycast={() => null}
      />
    </>
  )
}
