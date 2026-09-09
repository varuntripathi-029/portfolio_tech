import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BARRIER_X, TRACK_LENGTH } from './trackLayout'
import { buildBillboardGeometry } from './billboardGeometry'
import { makeLedAtlas, ledCellUV, BOARD_ASPECT } from './ledIconAtlas'

// Positive X reads as the driver's left in the forward-facing chase cam
// (verified visually), matching the spec's "Left Side" placement.
// Sat 4m back at 3.4m wide, which was unreadable from a chase cam 8m behind
// the car and 17m off-axis. Real trackside boards are this proportion; the
// fix is to break scale and bring them to the barrier line.
const BOARD_X = BARRIER_X + 1
// Derived from the atlas cell aspect, never guessed: a quad whose aspect does
// not match its cell shears the logo across the board.
const BOARD_HEIGHT = 2
const BOARD_WIDTH = BOARD_HEIGHT * BOARD_ASPECT
const BOARD_Y = 1 + BOARD_HEIGHT / 2 // bottom edge sits on the post at y=1
const SPACING = 24
const START_Z = 60
const POST_HEIGHT = 1

function boardPositions(): number[] {
  const positions: number[] = []
  for (let z = START_Z; z <= TRACK_LENGTH - START_Z; z += SPACING) positions.push(z)
  return positions
}

/** LED advertising boards, left side only. Opaque, high-contrast, not emissive. */
export function LedBoards() {
  const zPositions = useMemo(boardPositions, [])

  const texture = useMemo(() => makeLedAtlas(), [])
  const geometry = useMemo(
    () =>
      buildBillboardGeometry(
        zPositions.map((z, i) => ({
          x: BOARD_X,
          y: BOARD_Y,
          z,
          width: BOARD_WIDTH,
          height: BOARD_HEIGHT,
          uv: ledCellUV(i),
        })),
      ),
    [zPositions],
  )
  const material = useMemo(
    // Fully matte: any specular from the bright sunset HDRI would wash the
    // dark backing and logos out to a pale glare at most viewing angles.
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        roughness: 1,
        metalness: 0,
        // The near-black backing was washing to light grey under the sunset
        // sky, which kills the contrast the logos rely on.
        envMapIntensity: 0.35,
      }),
    [texture],
  )

  const postRef = useRef<THREE.InstancedMesh>(null!)
  const postGeometry = useMemo(() => new THREE.BoxGeometry(0.3, POST_HEIGHT, 0.3), [])
  const postMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#26262c', roughness: 0.8 }), [])

  // Two posts per board now that they are 8m wide; a single centre post under
  // a board that long reads as unsupported.
  const POST_INSET = BOARD_WIDTH / 2 - 0.6

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    zPositions.forEach((z, i) => {
      for (const [side, offset] of [[0, -POST_INSET], [1, POST_INSET]] as const) {
        dummy.position.set(BOARD_X, POST_HEIGHT / 2, z + offset)
        dummy.updateMatrix()
        postRef.current.setMatrixAt(i * 2 + side, dummy.matrix)
      }
    })
    postRef.current.instanceMatrix.needsUpdate = true
  }, [zPositions, POST_INSET])

  return (
    <>
      <mesh geometry={geometry} material={material} raycast={() => null} />
      <instancedMesh
        ref={postRef}
        args={[postGeometry, postMaterial, zPositions.length * 2]}
        raycast={() => null}
      />
    </>
  )
}
