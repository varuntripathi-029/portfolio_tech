import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BANDS, TRACK_LENGTH, type Band } from './trackLayout'
import { makeKerbTexture } from './kerbTexture'

/**
 * One long plane per surface band, mirrored to both sides. Blending four
 * surfaces in one shader costs four texture samples on every ground
 * fragment, and the ground fills most of the screen; separate planes cost
 * ~9 extra draw calls instead, far cheaper on integrated GPUs.
 */

type Side = 0 | 1 | -1

function bandGeometry(band: Band, side: Side) {
  const width = side === 0 ? band.outer * 2 : band.outer - band.inner
  const x = side === 0 ? 0 : side * (band.inner + (band.outer - band.inner) / 2)
  return {
    width,
    x,
    repeatX: width / band.tile,
    repeatY: TRACK_LENGTH / band.tile,
  }
}

function usePlaneGeometry(width: number, length: number) {
  return useMemo(() => new THREE.PlaneGeometry(width, length), [width, length])
}

function useAnisotropy() {
  const gl = useThree((s) => s.gl)
  return Math.min(8, gl.capabilities.getMaxAnisotropy())
}

function KerbBand({ band, side }: { band: Band; side: Side }) {
  const anisotropy = useAnisotropy()
  const { width, x, repeatX, repeatY } = bandGeometry(band, side)
  const geometry = usePlaneGeometry(width, TRACK_LENGTH)
  const texture = useMemo(() => makeKerbTexture(), [])

  const material = useMemo(() => {
    texture.repeat.set(repeatX, repeatY)
    texture.anisotropy = anisotropy
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0 })
  }, [texture, repeatX, repeatY, anisotropy])

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation-x={-Math.PI / 2}
      position={[x, band.y, TRACK_LENGTH / 2]}
      receiveShadow={band.receiveShadow}
      raycast={() => null}
    />
  )
}

function SurfaceBand({ band, side }: { band: Band; side: Side }) {
  const anisotropy = useAnisotropy()
  const { width, x, repeatX, repeatY } = bandGeometry(band, side)
  const geometry = usePlaneGeometry(width, TRACK_LENGTH)

  const { diff, nor, arm } = useTexture({
    diff: `/textures/${band.dir}/diff.jpg`,
    nor: `/textures/${band.dir}/nor_gl.jpg`,
    arm: `/textures/${band.dir}/arm.jpg`,
  })

  const material = useMemo(() => {
    for (const tex of [diff, nor, arm]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(repeatX, repeatY)
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
  }, [diff, nor, arm, repeatX, repeatY, anisotropy])

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation-x={-Math.PI / 2}
      position={[x, band.y, TRACK_LENGTH / 2]}
      receiveShadow={band.receiveShadow}
      raycast={() => null}
    />
  )
}

function BandPlane({ band, side }: { band: Band; side: Side }) {
  return band.dir ? <SurfaceBand band={band} side={side} /> : <KerbBand band={band} side={side} />
}

export function Ground() {
  return (
    <group>
      {BANDS.map((band) =>
        // A band starting at the centreline is one plane spanning both
        // sides; mirroring it into two halves would show a seam down the middle.
        band.inner === 0 ? (
          <BandPlane key={band.id} band={band} side={0} />
        ) : (
          <group key={band.id}>
            <BandPlane band={band} side={1} />
            <BandPlane band={band} side={-1} />
          </group>
        ),
      )}
    </group>
  )
}
