import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { Perf } from 'r3f-perf'
import { Ground } from './Ground'
import { Lighting } from './Lighting'
import { Car } from './Car'
import { ChaseCam } from './ChaseCam'

export function Scene() {
  return (
    <Canvas shadows camera={{ position: [0, 1.5, -3], fov: 55, near: 0.1, far: 3000 }}>
      <Suspense fallback={null}>
        <Environment files="/hdri/qwantani_sunset_puresky_1k.hdr" background />
        <Lighting />
        <Ground />
        <Car />
      </Suspense>

      <ChaseCam />

      {import.meta.env.DEV && <Perf position="top-left" />}
    </Canvas>
  )
}
