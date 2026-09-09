import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TRACK_LENGTH } from './trackLayout'
import { buildBillboardGeometry } from './billboardGeometry'
import { makeLedAtlas, ledCellUV, BOARD_ASPECT } from './ledIconAtlas'

const SPAN = 36 // clears both barriers (BARRIER_X=17) with margin
const HEIGHT = 8
const BEAM_THICKNESS = 0.6
const LEG_SIZE = 0.5
const SPACING = 200

// Panel hangs under the beam, dead centre of the frame as the car passes
// beneath. This is the most readable surface in the whole scene, so it
// carries the same logo atlas as the trackside boards.
const PANEL_WIDTH = 12
// Same contract as the trackside boards: height follows the atlas cell aspect.
const PANEL_HEIGHT = PANEL_WIDTH / BOARD_ASPECT
const PANEL_Y = HEIGHT - BEAM_THICKNESS / 2 - PANEL_HEIGHT / 2

function buildGantryGeometry(): THREE.BufferGeometry {
  const beam = new THREE.BoxGeometry(SPAN, BEAM_THICKNESS, BEAM_THICKNESS)
  beam.translate(0, HEIGHT, 0)

  const legLeft = new THREE.BoxGeometry(LEG_SIZE, HEIGHT, LEG_SIZE)
  legLeft.translate(-SPAN / 2, HEIGHT / 2, 0)

  const legRight = new THREE.BoxGeometry(LEG_SIZE, HEIGHT, LEG_SIZE)
  legRight.translate(SPAN / 2, HEIGHT / 2, 0)

  return mergeGeometries([beam, legLeft, legRight])
}

/** Overhead gantry every 200m. One merged shape (beam + two legs), instanced. */
export function GantryBridges() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(buildGantryGeometry, [])
  const material = useMemo(
    // Roughness 1 avoids the sunset sky's specular washing the structure
    // out (same issue found on the LED boards and barriers); metalness
    // dropped for the same reason.
    () => new THREE.MeshStandardMaterial({ color: '#3a3a42', roughness: 1, metalness: 0.1 }),
    [],
  )

  const zPositions = useMemo(() => {
    const arr: number[] = []
    for (let z = SPACING; z < TRACK_LENGTH; z += SPACING) arr.push(z)
    return arr
  }, [])

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    zPositions.forEach((z, i) => {
      dummy.position.set(0, 0, z)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [zPositions])

  // Panels cannot ride on the instanced gantry: instances share one UV set,
  // so each panel needs its own atlas cell baked into its own geometry.
  const panelTexture = useMemo(() => makeLedAtlas(), [])
  const panelGeometry = useMemo(
    () =>
      buildBillboardGeometry(
        zPositions.map((z, i) => ({
          x: 0,
          y: PANEL_Y,
          z,
          width: PANEL_WIDTH,
          height: PANEL_HEIGHT,
          // Offset the starting cell so a gantry never shows the same logo as
          // the trackside board beside it.
          uv: ledCellUV(i + 3),
          facing: 'z' as const,
        })),
      ),
    [zPositions],
  )
  const panelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: panelTexture,
        side: THREE.DoubleSide,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.35,
      }),
    [panelTexture],
  )

  return (
    <>
      <instancedMesh ref={ref} args={[geometry, material, zPositions.length]} raycast={() => null} />
      <mesh geometry={panelGeometry} material={panelMaterial} raycast={() => null} />
    </>
  )
}
