import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BANDS, type Band } from './trackLayout'
import { makeKerbTexture } from './kerbTexture'
import { buildRibbon } from './ribbon'
import { TRACK_LENGTH, frameAt } from '../track/trackFrame'

/**
 * One ribbon per surface band, swept along the circuit.
 *
 * v1 used one long plane per band, which a curve makes meaningless. What
 * carries over is the reason for keeping the bands as separate meshes: four
 * texture samples per ground fragment on a screen the ground mostly fills is
 * far more expensive on an integrated GPU than about nine extra draw calls.
 */

function useAnisotropy() {
  const gl = useThree((s) => s.gl)
  return Math.min(8, gl.capabilities.getMaxAnisotropy())
}

/** Bands starting at the centreline span both sides as one strip. */
function edgesFor(band: Band, side: 1 | -1): { from: number; to: number } {
  if (band.inner === 0) return { from: -band.outer, to: band.outer }
  return { from: side * band.inner, to: side * band.outer }
}

function KerbBand({ band, side }: { band: Band; side: 1 | -1 }) {
  const anisotropy = useAnisotropy()
  const { from, to } = edgesFor(band, side)
  const geometry = useMemo(
    () => buildRibbon({ from, to, y: band.y, tile: band.tile }),
    [from, to, band.y, band.tile],
  )
  const material = useMemo(() => {
    const texture = makeKerbTexture()
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.anisotropy = anisotropy
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0 })
  }, [anisotropy])

  return (
    <mesh
      geometry={geometry}
      material={material}
      receiveShadow={band.receiveShadow}
      raycast={() => null}
    />
  )
}

function SurfaceBand({ band, side }: { band: Band; side: 1 | -1 }) {
  const anisotropy = useAnisotropy()
  const { from, to } = edgesFor(band, side)
  const geometry = useMemo(
    () => buildRibbon({ from, to, y: band.y, tile: band.tile }),
    [from, to, band.y, band.tile],
  )

  const { diff, nor, arm } = useTexture({
    diff: `/textures/${band.dir}/diff.jpg`,
    nor: `/textures/${band.dir}/nor_gl.jpg`,
    arm: `/textures/${band.dir}/arm.jpg`,
  })

  const material = useMemo(() => {
    for (const tex of [diff, nor, arm]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      // The ribbon bakes tiling into its UVs, so the texture repeat stays 1:1.
      tex.repeat.set(1, 1)
      tex.anisotropy = anisotropy
    }
    diff.colorSpace = THREE.SRGBColorSpace

    return new THREE.MeshStandardMaterial({
      map: diff,
      normalMap: nor,
      // arm.jpg is channel-packed: AO in red, roughness in green, metalness in blue.
      aoMap: arm,
      roughnessMap: arm,
      metalnessMap: arm,
      roughness: 1,
      metalness: 1,
    })
  }, [diff, nor, arm, anisotropy])

  return (
    <mesh
      geometry={geometry}
      material={material}
      receiveShadow={band.receiveShadow}
      raycast={() => null}
    />
  )
}

function BandRibbon({ band, side }: { band: Band; side: 1 | -1 }) {
  return band.dir ? <SurfaceBand band={band} side={side} /> : <KerbBand band={band} side={side} />
}

/**
 * One flat plane under everything, so the infield and the far outfield are not
 * a hole through to the sky. A closed circuit seen from any raised angle shows
 * the middle of itself, which a straight track never did.
 */
function BasePlane() {
  const { size, centre } = useMemo(() => {
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (let s = 0; s < TRACK_LENGTH; s += 8) {
      const fr = frameAt(s)
      minX = Math.min(minX, fr.x)
      maxX = Math.max(maxX, fr.x)
      minZ = Math.min(minZ, fr.z)
      maxZ = Math.max(maxZ, fr.z)
    }
    // Generous margin so the horizon is ground, not an edge.
    const margin = 900
    return {
      size: Math.max(maxX - minX, maxZ - minZ) + margin * 2,
      centre: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    }
  }, [])

  const geometry = useMemo(() => new THREE.PlaneGeometry(size, size), [size])
  const material = useMemo(
    // Matte and unlit-looking on purpose: this is a backdrop, and anything
    // shinier competes with the surfaces that matter.
    () => new THREE.MeshStandardMaterial({ color: '#2a3326', roughness: 1, metalness: 0 }),
    [],
  )

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation-x={-Math.PI / 2}
      position={[centre.x, -0.05, centre.z]}
      raycast={() => null}
    />
  )
}

export function Ground() {
  return (
    <group>
      <BasePlane />
      {BANDS.map((band) =>
        band.inner === 0 ? (
          <BandRibbon key={band.id} band={band} side={1} />
        ) : (
          <group key={band.id}>
            <BandRibbon band={band} side={1} />
            <BandRibbon band={band} side={-1} />
          </group>
        ),
      )}
    </group>
  )
}
