import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { Perf } from 'r3f-perf'
import { Ground } from './Ground'
import { RoadMarkings } from './RoadMarkings'
import { Barriers } from './Barriers'
import { LedBoards } from './LedBoards'
import { GantryBridges } from './GantryBridges'
import { LightPoles } from './LightPoles'
import { MarshalPosts } from './MarshalPosts'
import { Grandstands } from './Grandstands'
import { Skyline } from './Skyline'
import { StartGantry } from './StartGantry'
import { SectionBoards } from './SectionBoards'
import { Lighting } from './Lighting'
import { Car } from './Car'
import { ChaseCam } from './ChaseCam'
import { DriftEffects } from './DriftEffects'
import { VerifyBridge } from './VerifyBridge'
import { useIsTouchDevice } from '../ui/useTouch'

/**
 * `r3f-perf`'s GPU-time readback (`EXT_disjoint_timer_query`) forces a
 * CPU-GPU sync every frame. Under headless Chromium's SwiftShader software
 * rendering that sync stalls hard enough to starve the page's own
 * `setTimeout` queue almost completely: a bare recursive `setTimeout` chain
 * that fires 8 times a second on a blank page fired ZERO times in 3.5s on
 * this scene with Perf mounted. Confirmed by disabling Perf and re-running
 * the same chain, which then fired on schedule. `scripts/verify.ts` appends
 * `?noperf=1` so Playwright runs never hit this; a real visitor never passes
 * that flag and never mounts DEV-only Perf regardless.
 */
const SKIP_PERF =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('noperf')

export function Scene() {
  // Block G4: capped pixel ratio on touch, part of "lighter render" -- dpr 2
  // on a high-density phone screen is 4x the fragment work of dpr 1.
  const isTouch = useIsTouchDevice()

  return (
    <Canvas
      shadows
      camera={{ position: [0, 2.6, -8], fov: 55, near: 0.1, far: 3000 }}
      dpr={isTouch ? [1, 1.5] : [1, 2]}
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
        <GantryBridges />
        <LightPoles />
        <MarshalPosts />
        <Grandstands />
        <Skyline />
        <StartGantry />
        <SectionBoards />
        <Car />
        <DriftEffects />
      </Suspense>

      <ChaseCam />

      {import.meta.env.DEV && !SKIP_PERF && <Perf position="bottom-left" />}
      {import.meta.env.DEV && <VerifyBridge />}
    </Canvas>
  )
}
