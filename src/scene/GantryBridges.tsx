import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildBillboardGeometry } from './billboardGeometry'
import { makeLedAtlas, ledCellUV, BOARD_ASPECT } from './ledIconAtlas'
import { GANTRIES } from '../track/props'
import { frameAt } from '../track/trackFrame'

const SPAN = 36 // clears both barriers at 17m with margin
const HEIGHT = 8
const BEAM_THICKNESS = 0.6
const LEG_SIZE = 0.5

/**
 * The panel hangs under the beam, dead centre of the frame as the car passes
 * beneath. It is the most readable surface in the scene, so it carries the same
 * logo atlas as the trackside boards, and like them its height follows the
 * atlas cell aspect rather than being chosen.
 */
const PANEL_WIDTH = 12
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

/**
 * Overhead gantries, on straights only.
 *
 * A 36m beam square across the track reads as broken if the track curves away
 * underneath it, so props.ts only places these on straights over 150m long.
 */
export function GantryBridges() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(buildGantryGeometry, [])
  const material = useMemo(
    // Roughness 1 avoids the sunset sky washing the structure out, the same
    // issue found on the LED boards and barriers; metalness dropped likewise.
    () => new THREE.MeshStandardMaterial({ color: '#3a3a42', roughness: 1, metalness: 0.1 }),
    [],
  )

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    GANTRIES.forEach((p, i) => {
      const fr = frameAt(p.s)
      dummy.position.set(fr.x, 0, fr.z)
      // The beam spans the track, so it is rotated to run along `left`.
      dummy.rotation.set(0, Math.atan2(fr.tx, fr.tz), 0)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [])

  // Panels cannot ride on the instanced gantry: instances share one UV set, so
  // each panel needs its own atlas cell baked into its own geometry.
  const panelTexture = useMemo(() => makeLedAtlas(), [])
  const panelGeometry = useMemo(
    () =>
      buildBillboardGeometry(
        GANTRIES.map((p, i) => {
          const fr = frameAt(p.s)
          return {
            x: fr.x,
            y: PANEL_Y,
            z: fr.z,
            width: PANEL_WIDTH,
            height: PANEL_HEIGHT,
            // Offset the starting cell so a gantry never shows the same logo
            // as the trackside board beside it.
            uv: ledCellUV(i + 3),
            // Width runs across the track, so the face looks back down it at
            // an approaching car.
            right: { x: fr.lx, z: fr.lz },
          }
        }),
      ),
    [],
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
      <instancedMesh
        ref={ref}
        args={[geometry, material, GANTRIES.length]}
        raycast={() => null}
      />
      <mesh geometry={panelGeometry} material={panelMaterial} raycast={() => null} />
    </>
  )
}
