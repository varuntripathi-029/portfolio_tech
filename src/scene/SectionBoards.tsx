import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { buildBillboardGeometry } from './billboardGeometry'
import { makeSectionBoardAtlas, sectionBoardUV, SECTION_BOARD_ASPECT, BOARD_SECTIONS } from './sectionBoardAtlas'
import { OUTSIDE_SIGN, frameAt, wrapS } from '../track/trackFrame'
import { BARRIER_X } from './trackLayout'

/** Same board-plus-two-posts shape as LedBoards.tsx, sized for a name-only
 * board rather than a mark-plus-wordmark one. */
const BOARD_HEIGHT = 1.6
const BOARD_WIDTH = BOARD_HEIGHT * SECTION_BOARD_ASPECT
const BOARD_Y = 1 + BOARD_HEIGHT / 2
const POST_HEIGHT = 1
const POST_INSET = BOARD_WIDTH / 2 - 0.4

/**
 * Read on approach, ahead of the braking zone the marker itself sits in.
 * 90m clears the braking zone's own lead distance (v^2/2a at top speed is
 * about 76m, spec 6.3), so the board is passed while still in free driving,
 * not already mid-brake.
 */
const LEAD_DISTANCE = 90
const BOARD_D = OUTSIDE_SIGN * (BARRIER_X + 4)

/**
 * One board per non-grid section, placed on the straight ahead of its
 * braking marker: real F1 corner boards, repurposed to name the section a
 * car is about to arrive at rather than a corner number.
 */
export function SectionBoards() {
  const texture = useMemo(() => makeSectionBoardAtlas(), [])

  const geometry = useMemo(
    () =>
      buildBillboardGeometry(
        BOARD_SECTIONS.map((section, i) => {
          const s = wrapS(section.s - LEAD_DISTANCE)
          const fr = frameAt(s)
          return {
            x: fr.x + fr.lx * BOARD_D,
            y: BOARD_Y,
            z: fr.z + fr.lz * BOARD_D,
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            uv: sectionBoardUV(i),
            right: { x: fr.tx, z: fr.tz },
          }
        }),
      ),
    [],
  )

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        roughness: 1,
        metalness: 0,
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
    BOARD_SECTIONS.forEach((section, i) => {
      const boardS = wrapS(section.s - LEAD_DISTANCE)
      for (const [side, offset] of [
        [0, -POST_INSET],
        [1, POST_INSET],
      ] as const) {
        const fr = frameAt(wrapS(boardS + offset))
        dummy.position.set(fr.x + fr.lx * BOARD_D, POST_HEIGHT / 2, fr.z + fr.lz * BOARD_D)
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
        args={[postGeometry, postMaterial, BOARD_SECTIONS.length * 2]}
        raycast={() => null}
      />
    </>
  )
}
