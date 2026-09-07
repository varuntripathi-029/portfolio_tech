import { useMemo } from 'react'
import * as THREE from 'three'
import { FUEL_OUT_Z } from '../data/timeline'

const BOARD_X = -21 // right side, same convention as YearSigns
const BOARD_WIDTH = 6
const BOARD_HEIGHT = 2.4
const POST_HEIGHT = 1.5
const BOARD_Y = POST_HEIGHT + BOARD_HEIGHT / 2

function makeFuelBoardTexture(): THREE.CanvasTexture {
  const W = 1024
  const H = 410
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#14141a'
  ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'

  ctx.fillStyle = '#e10600'
  ctx.font = 'bold 90px sans-serif'
  ctx.fillText('FUEL LOW', W / 2, 175)

  // No em dash, project-wide rule: colon instead of the spec's own dash.
  ctx.fillStyle = '#f2f2f0'
  ctx.font = 'bold 58px sans-serif'
  ctx.fillText('RACE INCOMPLETE', W / 2, 290)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** The trackside board for the fuel-out ending. No checkered flag, ever. */
export function FuelBoard() {
  const texture = useMemo(() => makeFuelBoardTexture(), [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, roughness: 1, side: THREE.DoubleSide }),
    [texture],
  )
  const geometry = useMemo(() => new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT), [])
  const postGeometry = useMemo(() => new THREE.BoxGeometry(0.3, POST_HEIGHT, 0.3), [])
  const postMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#26262c', roughness: 1 }), [])

  return (
    <group position={[BOARD_X, 0, FUEL_OUT_Z - 15]}>
      <mesh
        geometry={geometry}
        material={material}
        position={[0, BOARD_Y, 0]}
        rotation-y={Math.PI / 2}
        raycast={() => null}
      />
      <mesh
        geometry={postGeometry}
        material={postMaterial}
        position={[0, POST_HEIGHT / 2, 0]}
        raycast={() => null}
      />
    </group>
  )
}
