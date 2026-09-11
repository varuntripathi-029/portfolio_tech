import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/**
 * DEV-only hooks for `scripts/verify.ts`.
 *
 * The automated Chrome extension available in this environment backgrounds
 * every tab it drives, which pauses `requestAnimationFrame` outright, so
 * `useFrame` never ticks and the canvas never paints (spec 6.1). Playwright
 * runs a real headless Chromium instead, where rAF works normally, but it
 * still needs a way to read scene state and drive the sim without pixel-
 * perfect mouse clicks on a 3D scene. This is that way: `window.__renderer`
 * for the draw-call and triangle counts the report asks for.
 *
 * Gated on `import.meta.env.DEV` so none of it reaches a production build.
 */
export function VerifyBridge() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    ;(window as unknown as { __renderer: typeof gl }).__renderer = gl
  }, [gl])

  // A plain counter read twice across a wall-clock gap (see verify.ts's
  // fps()) gives an accurate in-page frame rate from two cheap round trips,
  // instead of one round trip PER FRAME via a page-side rAF chain, which
  // would measure Playwright's CDP latency far more than the render loop.
  useFrame(() => {
    const w = window as unknown as { __frameCount: number }
    w.__frameCount = (w.__frameCount ?? 0) + 1
  })

  return null
}
