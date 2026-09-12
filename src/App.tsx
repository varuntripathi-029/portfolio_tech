import { useEffect } from 'react'
import { Scene } from './scene/Scene'
import { Overlay } from './ui/Overlay'
import { assertCircuit, assertPropClearance, assertPropsOutside } from './track/assertions'
import { collectProps, collectOutsideProps } from './track/props'
import { useRaceStore } from './state/raceStore'
import { SECTIONS, type SectionId } from './data/sections'
import { contextState, currentGains } from './audio/engine'

/**
 * The geometry checks run once at boot in dev.
 *
 * They are the same functions the sim and plot scripts use, and running them
 * here too means a bad edit to the circuit fails loudly in the browser instead
 * of showing a barrier through the middle of a distant corner that nobody
 * drives to for another hour.
 */
if (import.meta.env.DEV) {
  assertCircuit()
  assertPropClearance(collectProps())
  assertPropsOutside(collectOutsideProps())
}

/**
 * DEV-only hooks for `scripts/verify.ts`.
 *
 * `__phase` reads the current race phase and `__warpTo` requests a navbar-
 * style warp, both used to drive the headless Playwright run past long
 * stretches of ordinary driving (e.g. jumping straight to CONTACT for a
 * camera shot) without needing real pixel-accurate clicks on a 3D scene.
 * Gated on `import.meta.env.DEV`, so none of it reaches a production build.
 */
function VerifyHooks() {
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as {
      __phase: () => string
      __warpTo: (id: SectionId) => void
      __audio: () => { state: string; gains: ReturnType<typeof currentGains> }
    }
    w.__phase = () => useRaceStore.getState().phase
    w.__warpTo = (id) => {
      if (!SECTIONS.some((s) => s.id === id)) throw new Error(`verify: no section "${id}"`)
      useRaceStore.getState().requestWarp({ section: id })
    }
    w.__audio = () => ({ state: contextState(), gains: currentGains() })
  }, [])
  return null
}

export default function App() {
  return (
    <div className="h-screen w-screen bg-carbon">
      <Scene />
      <Overlay />
      {import.meta.env.DEV && <VerifyHooks />}
    </div>
  )
}
