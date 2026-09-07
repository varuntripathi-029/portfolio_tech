import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { TIMELINE, type TimelineEvent } from '../data/timeline'
import { BARRIER_X } from './trackLayout'

const BOARD_X = -(BARRIER_X + 8) // right side, beyond the year signs
const BOARD_WIDTH = 3
const BOARD_HEIGHT = 1.8
const BOARD_Y_BASE = 1
const RAYCAST_DISTANCE = 50
const APPROACH_OFFSET = 30 // before the event's trackZ, so it reads before the car slows

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line.trim())
      line = word + ' '
    } else {
      line = test
    }
  }
  lines.push(line.trim())
  const startY = y - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight))
}

function makeBillboardTexture(event: TimelineEvent): THREE.CanvasTexture {
  const W = 512
  const H = 307
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#14141a'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#e10600'
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, W - 6, H - 6)

  ctx.fillStyle = '#f2f2f0'
  ctx.textAlign = 'center'
  ctx.font = 'bold 32px sans-serif'
  wrapText(ctx, event.title, W / 2, 120, W - 70, 40)

  ctx.fillStyle = '#949498'
  ctx.font = '20px monospace'
  ctx.fillText('VIEW PROJECT', W / 2, H - 36)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** One clickable billboard for one event. Real navigation, not a canvas fake link. */
function Billboard({ event, z }: { event: TimelineEvent; z: number }) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  const camera = useThree((s) => s.camera)
  const ref = useRef<THREE.Mesh>(null!)
  const texture = useMemo(() => makeBillboardTexture(event), [event])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, roughness: 1, side: THREE.DoubleSide }),
    [texture],
  )
  const geometry = useMemo(() => new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT), [])

  // Hit-testing this every frame against all boards is wasted once the car
  // is far away, so it's disabled beyond RAYCAST_DISTANCE.
  useFrame(() => {
    if (!ref.current) return
    const inRange = Math.abs(camera.position.z - z) <= RAYCAST_DISTANCE
    ref.current.raycast = inRange ? THREE.Mesh.prototype.raycast : () => {}
  })

  const url = event.liveUrl ?? event.repoUrl

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      position={[BOARD_X, BOARD_Y_BASE + BOARD_HEIGHT / 2, z]}
      rotation-y={Math.PI / 2}
      onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    />
  )
}

/** Bonus click layer over the mandatory DOM card links. Project/pivot events only. */
export function EventBillboards() {
  const withLinks = TIMELINE.filter((e) => e.liveUrl || e.repoUrl)
  return (
    <>
      {withLinks.map((event) => (
        <Billboard key={event.id} event={event} z={event.trackZ - APPROACH_OFFSET} />
      ))}
    </>
  )
}
