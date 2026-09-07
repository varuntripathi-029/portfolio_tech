import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BARRIER_X, TRACK_LENGTH } from './trackLayout'
import { buildBillboardGeometry } from './billboardGeometry'
import { makeYearAtlas, yearCellUV, YEAR_COUNT } from './yearSignAtlas'

// Negative X reads as the driver's right in the forward-facing chase cam
// (verified visually), matching the spec's "Right Side" placement.
const SIGN_X = -(BARRIER_X + 4)
const SIGN_WIDTH = 2
const SIGN_HEIGHT = 4
const POST_HEIGHT = 1.5
const SIGN_Y = POST_HEIGHT + SIGN_HEIGHT / 2

function signPositions(): number[] {
  const spacing = TRACK_LENGTH / (YEAR_COUNT + 1)
  return Array.from({ length: YEAR_COUNT }, (_, i) => spacing * (i + 1))
}

/** Year signboards, right side. Timeline event billboards are phase 4. */
export function YearSigns() {
  const zPositions = useMemo(signPositions, [])

  const texture = useMemo(() => makeYearAtlas(), [])
  const geometry = useMemo(
    () =>
      buildBillboardGeometry(
        zPositions.map((z, i) => ({
          x: SIGN_X,
          y: SIGN_Y,
          z,
          width: SIGN_WIDTH,
          height: SIGN_HEIGHT,
          uv: yearCellUV(i),
          flip: true,
        })),
      ),
    [zPositions],
  )
  const material = useMemo(
    // Fully matte, same reasoning as LedBoards: avoid HDRI glare on the text.
    () => new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 1 }),
    [texture],
  )

  const postRef = useRef<THREE.InstancedMesh>(null!)
  const postGeometry = useMemo(() => new THREE.BoxGeometry(0.3, POST_HEIGHT, 0.3), [])
  const postMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#26262c', roughness: 0.8 }), [])

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    zPositions.forEach((z, i) => {
      dummy.position.set(SIGN_X, POST_HEIGHT / 2, z)
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
