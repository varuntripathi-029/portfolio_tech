import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { buildBillboardGeometry } from './billboardGeometry'
import { makeLedAtlas, ledCellUV, BOARD_ASPECT } from './ledIconAtlas'
import { LED_BOARDS } from '../track/props'
import { frameAt } from '../track/trackFrame'

/**
 * Height is the free dimension and width follows the atlas cell aspect. Never
 * hardcode both: a quad whose aspect does not match its cell shears the logo
 * across the board, which is exactly how the 8x stretch happened in v1.
 */
const BOARD_HEIGHT = 2
const BOARD_WIDTH = BOARD_HEIGHT * BOARD_ASPECT
const BOARD_Y = 1 + BOARD_HEIGHT / 2 // bottom edge sits on the post at y=1
const POST_HEIGHT = 1

/** Two posts per board: one centre post under a board this wide reads as unsupported. */
const POST_INSET = BOARD_WIDTH / 2 - 0.6

export function LedBoards() {
  const texture = useMemo(() => makeLedAtlas(), [])

  const geometry = useMemo(
    () =>
      buildBillboardGeometry(
        LED_BOARDS.map((p, i) => {
          const fr = frameAt(p.s)
          return {
            x: fr.x + fr.lx * p.d,
            y: BOARD_Y,
            z: fr.z + fr.lz * p.d,
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            uv: ledCellUV(i),
            // Width runs along the track, so the face looks across it at the
            // racing line rather than along the barrier.
            right: { x: fr.tx, z: fr.tz },
          }
        }),
      ),
    [],
  )

  const material = useMemo(
    // Fully matte: any specular from the bright sunset HDRI washes the dark
    // backing and the logos out to a pale glare at most viewing angles.
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        roughness: 1,
        metalness: 0,
        // The near-black backing was washing to light grey under the sky.
        envMapIntensity: 0.35,
      }),
    [texture],
  )

  const postRef = useRef<THREE.InstancedMesh>(null!)
  const postGeometry = useMemo(() => new THREE.BoxGeometry(0.3, POST_HEIGHT, 0.3), [])
  const postMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#26262c', roughness: 0.8 }),
    [],
  )

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    LED_BOARDS.forEach((p, i) => {
      for (const [side, offset] of [
        [0, -POST_INSET],
        [1, POST_INSET],
      ] as const) {
        // Posts step along the track from the board centre, so they follow the
        // curve instead of sitting on a chord.
        const fr = frameAt(p.s + offset)
        dummy.position.set(fr.x + fr.lx * p.d, POST_HEIGHT / 2, fr.z + fr.lz * p.d)
        dummy.updateMatrix()
        postRef.current.setMatrixAt(i * 2 + side, dummy.matrix)
      }
    })
    postRef.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <>
      <mesh geometry={geometry} material={material} raycast={() => null} />
      <instancedMesh
        ref={postRef}
        args={[postGeometry, postMaterial, LED_BOARDS.length * 2]}
        raycast={() => null}
      />
    </>
  )
}
