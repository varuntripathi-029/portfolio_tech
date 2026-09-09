import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { Perf } from 'r3f-perf'
import { Ground } from './Ground'
import { RoadMarkings } from './RoadMarkings'
import { Barriers } from './Barriers'
import { LedBoards } from './LedBoards'
import { YearSigns } from './YearSigns'
import { EventBillboards } from './EventBillboards'
import { FuelBoard } from './FuelBoard'
import { GantryBridges } from './GantryBridges'
import { LightPoles } from './LightPoles'
import { MarshalPosts } from './MarshalPosts'
import { Grandstands } from './Grandstands'
import { Lighting } from './Lighting'
import { Car } from './Car'
import { ChaseCam } from './ChaseCam'

export function Scene() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 2.6, -8], fov: 55, near: 0.1, far: 3000 }}
      // environmentIntensity only dims the lighting contribution.
      // backgroundIntensity is a separate property that defaults to 1, so the
      // visible sky stayed blown to white while the scene got darker.
      gl={{ toneMappingExposure: 0.65 }}
    >
      <Suspense fallback={null}>
        <Environment
          files="/hdri/qwantani_sunset_puresky_1k.hdr"
          background
          // Sky sits well above 1.0 in radiance, and ACES desaturates
          // everything it rolls off, which is why an orange sunset was
          // arriving as pale cream. Scaling the background down before tone
          // mapping restores the colour. Lighting is unaffected: that is
          // environmentIntensity, which stays put.
          backgroundIntensity={0.35}
          environmentIntensity={0.6}
        />
        <Lighting />
        <Ground />
        <RoadMarkings />
        <Barriers />
        <LedBoards />
        <YearSigns />
        <EventBillboards />
        <FuelBoard />
        <GantryBridges />
        <LightPoles />
        <MarshalPosts />
        <Grandstands />
        <Car />
      </Suspense>

      <ChaseCam />

      {import.meta.env.DEV && <Perf position="bottom-left" />}
    </Canvas>
  )
}
