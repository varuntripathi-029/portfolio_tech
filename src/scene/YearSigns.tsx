import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BARRIER_X } from './trackLayout'
import { buildBillboardGeometry } from './billboardGeometry'
import { makeYearAtlas, yearCellUV } from './yearSignAtlas'
import { TIMELINE } from '../data/timeline'

// Negative X reads as the driver's right in the forward-facing chase cam
// (verified visually), matching the spec's "Right Side" placement.
const SIGN_X = -(BARRIER_X + 4)
const SIGN_WIDTH = 2
const SIGN_HEIGHT = 4
const POST_HEIGHT = 1.5
const SIGN_Y = POST_HEIGHT + SIGN_HEIGHT / 2
const SIGN_LEAD = 20 // metres before that year's first event

const YEARS = [2023, 2024, 2025, 2026]

/** Each sign sits just before the first timeline event of that year. */
function signPositions(): number[] {
  return YEARS.map((year) => {
    const zs = TIMELINE.filter((e) => e.year === year).map((e) => e.trackZ)
    return Math.max(10, Math.min(...zs) - SIGN_LEAD)
  })
}

/** Year signboards, right side. Event billboards are built separately. */
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
