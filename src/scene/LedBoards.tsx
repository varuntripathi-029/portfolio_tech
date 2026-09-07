import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BARRIER_X, TRACK_LENGTH } from './trackLayout'
import { buildBillboardGeometry } from './billboardGeometry'
import { makeLedAtlas, ledCellUV } from './ledIconAtlas'

// Positive X reads as the driver's left in the forward-facing chase cam
// (verified visually), matching the spec's "Left Side" placement.
const BOARD_X = BARRIER_X + 4
const BOARD_WIDTH = 3.4
const BOARD_HEIGHT = 2.4
const BOARD_Y = 1 + BOARD_HEIGHT / 2 // bottom edge sits on the post at y=1
const SPACING = 50
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
    () => new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 1, metalness: 0 }),
    [texture],
  )

  const postRef = useRef<THREE.InstancedMesh>(null!)
  const postGeometry = useMemo(() => new THREE.BoxGeometry(0.3, POST_HEIGHT, 0.3), [])
  const postMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#26262c', roughness: 0.8 }), [])

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    zPositions.forEach((z, i) => {
      dummy.position.set(BOARD_X, POST_HEIGHT / 2, z)
      dummy.updateMatrix()
      postRef.current.setMatrixAt(i, dummy.matrix)
    })
    postRef.current.instanceMatrix.needsUpdate = true
  }, [zPositions])

  return (
    <>
      <mesh geometry={geometry} material={material} raycast={() => null} />
      <instancedMesh
        ref={postRef}
        args={[postGeometry, postMaterial, zPositions.length]}
        raycast={() => null}
      />
    </>
  )
}
