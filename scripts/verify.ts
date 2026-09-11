/**
 * Visual verification via headless Chromium.
 *
 *   npx tsx scripts/verify.ts <block>
 *
 * The automated Chrome extension available in this environment reports
 * `document.visibilityState === "hidden"` for the tab it drives, which pauses
 * `requestAnimationFrame` outright, so `useFrame` never ticks and WebGL never
 * paints (see spec 6.1 and KNOWN TRAPS #2). Playwright launches its own
 * Chromium process with a real (if headless) compositor, so rAF runs
 * normally and the canvas actually renders. This is the substitute.
 *
 * Requires `npm run dev` already running on localhost:5173 (or PORT env).
 */

import { chromium, type Page } from 'playwright'
import { mkdirSync } from 'node:fs'

const PORT = process.env.PORT ?? '5173'
// See Scene.tsx's SKIP_PERF: r3f-perf's GPU-readback stats stall the timer
// queue hard enough under headless software rendering that setTimeout chains
// (the lights countdown, among others) never fire. noperf=1 skips mounting it
// for this run only; a real visitor never passes the flag.
const BASE = `http://localhost:${PORT}/?noperf=1`
const OUT_DIR = 'verify'

mkdirSync(OUT_DIR, { recursive: true })

async function shot(page: Page, name: string) {
  const phase = await page
    .evaluate(() => (window as unknown as { __phase: () => string }).__phase())
    .catch(() => '?')
  await page.screenshot({ path: `${OUT_DIR}/${name}.png` })
  console.log(`  wrote ${OUT_DIR}/${name}.png  (phase: ${phase})`)
}

/**
 * Holds a key down for `ms`, using CDP-level key events so the synthetic
 * KeyboardEvent looks like a real one to the page (real key, not a bare
 * dispatchEvent on window, which is what the nav-focus guard trap is about).
 */
async function holdKey(page: Page, key: string, ms: number) {
  await page.keyboard.down(key)
  await page.waitForTimeout(ms)
  await page.keyboard.up(key)
}

/**
 * Waits for the scene to actually be ready to drive, rather than a flat
 * timeout. Headless software rendering decodes the GLB and the HDRI far
 * slower than a real GPU, and a fixed wait sometimes raced it: the car's
 * `useDriveInput` effect had not attached its keydown listener yet, so the
 * very first W press was silently dropped and the phase never left 'lights'.
 * Triangle count climbing past the car's own 53K is a reliable proxy for "the
 * car has mounted", since nothing else in the scene is anywhere close to that
 * many triangles on its own.
 */
async function waitCarLoaded(page: Page, timeoutMs = 20000) {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __renderer?: { info: { render: { triangles: number } } } }
      return (w.__renderer?.info.render.triangles ?? 0) > 60000
    },
    undefined,
    { timeout: timeoutMs },
  )
}

async function waitPhase(page: Page, phase: string, timeoutMs = 8000) {
  await page.waitForFunction(
    (p) => (window as unknown as { __phase?: () => string }).__phase?.() === p,
    phase,
    { timeout: timeoutMs },
  )
}

async function currentPhase(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __phase: () => string }).__phase())
}

async function fps(page: Page, sampleMs = 1000): Promise<number> {
  // Reads VerifyBridge's frame counter twice across a wall-clock gap: two
  // cheap round trips, not one per frame. An earlier version chained
  // requestAnimationFrame calls THROUGH page.evaluate, which (a) measured
  // Playwright's CDP round-trip latency far more than the actual render
  // loop, and (b) crashed outright: tsx's esbuild transform wraps named
  // function/arrow bindings in a `__name(fn, "fn")` call to preserve `.name`
  // after minification, and that helper does not exist in the browser realm
  // Playwright re-evaluates the stringified callback in, so any named
  // recursive helper there threw "__name is not defined".
  const before = await page.evaluate(
    () => (window as unknown as { __frameCount?: number }).__frameCount ?? 0,
  )
  await page.waitForTimeout(sampleMs)
  const after = await page.evaluate(
    () => (window as unknown as { __frameCount?: number }).__frameCount ?? 0,
  )
  return ((after - before) / sampleMs) * 1000
}

async function drawCalls(page: Page): Promise<{ calls: number; triangles: number } | null> {
  return page.evaluate(() => {
    const w = window as unknown as { __renderer?: { info: { render: { calls: number; triangles: number } } } }
    if (!w.__renderer) return null
    return { calls: w.__renderer.info.render.calls, triangles: w.__renderer.info.render.triangles }
  })
}

async function main() {
  const block = process.argv[2] ?? 'A'
  // headless: false is load-bearing, not cosmetic. Measured: Chromium's
  // headless compositor throttled requestAnimationFrame to about 2fps on this
  // machine regardless of any background-tab flag, which starved every
  // useFrame hook (the whole sim, the camera, the lights timer) almost
  // completely -- distinct from, and worse than, the Chrome-extension tab's
  // rAF being fully PAUSED (KNOWN TRAPS #2). A headed window measured 115fps
  // on the same page. This machine has a display session available, so a
  // real (visible) window is the fix, not a workaround.
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('  [console error]', msg.text())
  })
  page.on('pageerror', (err) => console.error('  [page error]', err.message))

  console.log(`verify block ${block}`)
  // Not 'networkidle': Vite's dev-server HMR socket stays open forever, so
  // that condition never resolves against the dev server.
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForSelector('canvas', { timeout: 15000 })
  // Real readiness check, not a flat wait: see waitCarLoaded.
  await waitCarLoaded(page)
  await page.waitForTimeout(300)

  if (block === 'A') {
    await shot(page, 'A_front_grid')

    await holdKey(page, 'w', 80)
    await page.waitForTimeout(1100)
    await shot(page, 'A_orbit_midway')

    await waitPhase(page, 'driving', 6000)
    await page.keyboard.down('w')
    await page.waitForTimeout(1500)
    await shot(page, 'A_chase_driving')
    await page.keyboard.up('w')

    // Hold W continuously until a section stop is reached (phase 'stopped'),
    // rather than guessing a duration: the exact time to the first marker
    // depends on the resolved circuit.
    await page.keyboard.down('w')
    try {
      await waitPhase(page, 'stopped', 25000)
    } finally {
      await page.keyboard.up('w')
    }
    await page.waitForTimeout(300)
    await shot(page, 'A_stop_card')

    // Skip to CONTACT via the debug warp hook rather than driving three more
    // full sections, which is a legitimate save when only the CAMERA and
    // CARD behaviour (not the drive itself) are what this shot verifies.
    await page.evaluate(() => (window as unknown as { __warpTo: (id: string) => void }).__warpTo('contact'))
    await waitPhase(page, 'dry', 6000)
    // Full LAUNCH_DURATION (2.2s) so the chase-to-front orbit has actually
    // settled, not a mid-swing frame.
    await page.waitForTimeout(2400)
    await shot(page, 'A_contact_front')

    // Creeping covers CONTACT_BEFORE_LINE (40m) at CREEP_SPEED (6 m/s), so
    // about 6.7s before 'launching' starts. Generous margin over that.
    await holdKey(page, 'w', 80)
    await waitPhase(page, 'launching', 12000)
    await page.waitForTimeout(200)
    await shot(page, 'A_lap2_launch')
  }

  if (block === 'B') {
    await page.evaluate(() => (window as unknown as { __warpTo: (id: string) => void }).__warpTo('projects'))
    await waitPhase(page, 'stopped', 6000)
    await page.keyboard.press('Escape').catch(() => {})
    await page.mouse.click(700, 450) // dismiss card focus, click empty canvas area
    await page.waitForTimeout(300)
    await shot(page, 'B_minimap_start')

    await page.evaluate(() => (window as unknown as { __warpTo: (id: string) => void }).__warpTo('experience'))
    await waitPhase(page, 'stopped', 6000)
    await page.waitForTimeout(300)
    await shot(page, 'B_minimap_mid_lap')

    await page.evaluate(() => (window as unknown as { __warpTo: (id: string) => void }).__warpTo('driver'))
    await waitPhase(page, 'stopped', 6000)
    await page.keyboard.down('w')
    await page.waitForTimeout(50)
    await page.keyboard.up('w')
    await waitPhase(page, 'launching', 4000)
    await waitPhase(page, 'driving', 5000)
    await page.keyboard.down('w')
    await page.waitForTimeout(1500)
    await shot(page, 'B_dashboard_accelerating')
    await page.waitForTimeout(4000)
    await shot(page, 'B_dashboard_shift_lights')
    await page.keyboard.up('w')
  }

  const fpsGrid = block === 'A' ? await fps(page) : null
  const calls = await drawCalls(page)
  if (fpsGrid !== null) console.log(`  fps sample: ${fpsGrid.toFixed(1)}`)
  if (calls) console.log(`  draw calls ${calls.calls}, triangles ${calls.triangles}`)

  await browser.close()
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
