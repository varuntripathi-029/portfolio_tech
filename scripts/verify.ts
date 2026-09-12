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
    // A mid-lap 'stopped' departure (any section, including DRIVER reached
    // by warp) goes straight to 'driving': 'launching' is only for a true
    // lap start (see Car.tsx's 'stopped' case and FINAL2_NOTES.md).
    await page.keyboard.down('w')
    await waitPhase(page, 'driving', 5000)
    await page.keyboard.down('w')
    await page.waitForTimeout(1500)
    await shot(page, 'B_dashboard_accelerating')
    await page.waitForTimeout(4000)
    await shot(page, 'B_dashboard_shift_lights')
    await page.keyboard.up('w')
  }

  // PERF GUARD: fps at grid, mid-lap and with a card open, now that cards
  // carry a real backdrop-filter for the first time (Block A/B deferred this
  // exact three-point comparison, see FINAL2_NOTES.md).
  const perfGuard: { grid?: number; card?: number; midLap?: number } = {}

  if (block === 'D') {
    perfGuard.grid = await fps(page)

    await page.evaluate(() => (window as unknown as { __warpTo: (id: string) => void }).__warpTo('projects'))
    await waitPhase(page, 'stopped', 6000)
    await page.waitForTimeout(500) // let the arrival flash and entrance settle
    await shot(page, 'D_projects_card')
    perfGuard.card = await fps(page)

    // Hover over the glass to trigger Panel's cursor-follow light and tilt.
    await page.mouse.move(760, 420, { steps: 12 })
    await page.waitForTimeout(200)
    await shot(page, 'D_projects_card_hover')

    await page.evaluate(() => (window as unknown as { __warpTo: (id: string) => void }).__warpTo('achievements'))
    await waitPhase(page, 'stopped', 6000)
    await page.waitForTimeout(500)
    await shot(page, 'D_achievements_card')

    await page.evaluate(() => (window as unknown as { __warpTo: (id: string) => void }).__warpTo('experience'))
    await waitPhase(page, 'stopped', 6000)
    await page.waitForTimeout(500)
    await shot(page, 'D_experience_card')

    await page.evaluate(() => (window as unknown as { __warpTo: (id: string) => void }).__warpTo('contact'))
    await waitPhase(page, 'dry', 6000)
    await page.waitForTimeout(500)
    await shot(page, 'D_contact_card')

    // Dismiss the card and drive a moment: the mid-lap sample the PERF GUARD
    // wants, with no card and no menu up.
    await holdKey(page, 'w', 80)
    await waitPhase(page, 'driving', 12000)
    await page.keyboard.down('w')
    await page.waitForTimeout(1200)
    perfGuard.midLap = await fps(page)
    await page.keyboard.up('w')

    // The pill renders its label twice (an inverted copy for the hover wipe),
    // so the accessible name concatenates to "ProjectsProjects"; a substring
    // match against the <nav> bar specifically (not the mega menu's own rows,
    // several of which also contain "Projects") is what actually targets it.
    const projectsPill = page.locator('nav button', { hasText: 'Projects' }).first()
    await projectsPill.click()
    await page.waitForTimeout(400)
    await shot(page, 'D_megamenu_projects')

    console.log(
      `  PERF GUARD fps: grid ${perfGuard.grid?.toFixed(1)}, card ${perfGuard.card?.toFixed(1)}, mid-lap ${perfGuard.midLap?.toFixed(1)}`,
    )
  }

  if (block === 'E') {
    await shot(page, 'E_wide_track_view')

    // 'launching' (the lit start gantry) only happens at a true lap start,
    // never from a mid-lap warp-to-DRIVER-then-W (see Block B's own note on
    // that same distinction), so this has to be captured now, before
    // anything else spends the one free launch this page load gets.
    await holdKey(page, 'w', 80)
    await waitPhase(page, 'launching', 5000)
    await page.waitForTimeout(600)
    await shot(page, 'E_start_gantry')
    await waitPhase(page, 'driving', 6000)

    // One continuous hold covers all three: a grandstand sits every 400m
    // (GRANDSTAND_D = BARRIER_X + 17), the skyline rings the whole loop, and
    // the PROJECTS section board sits 45m ahead of its marker (simulateLap
    // puts that marker at s=751m, reached at 13.9s with no reading time) --
    // all reachable inside one launch-to-first-stop run, which also means
    // none of these shots fight the SectionCard modal for screen space.
    await page.keyboard.down('w')
    await page.waitForTimeout(4000)
    await shot(page, 'E_crowd_grandstand')
    await page.waitForTimeout(4000)
    await shot(page, 'E_skyline')
    await page.waitForTimeout(3300) // ~11.3s total: board now 90m ahead of the marker, still free driving
    await shot(page, 'E_section_board')
    await page.keyboard.up('w')
  }

  if (block === 'F') {
    // Launch, then drive forward a few seconds before stopping: reverse only
    // engages from free driving, well clear of any braking zone.
    await holdKey(page, 'w', 80)
    await waitPhase(page, 'driving', 5000)
    await page.keyboard.down('w')
    await page.waitForTimeout(1500)
    await page.keyboard.up('w')

    // Brake to a stop, then keep holding S: past REVERSE_ENGAGE_TIME (0.3s)
    // stationary, reverse engages on its own.
    await page.keyboard.down('s')
    await page.waitForTimeout(2500) // brakes to rest, then the 0.3s hold
    await shot(page, 'F_reverse_dashboard_R')

    // Keep holding S (the reverse "gas") long enough to cover the ~5m back
    // to the line and wrap past it -- REVERSE_TOP_SPEED is ~7 m/s, so a few
    // seconds covers well over that distance from a near-standstill start.
    await page.waitForTimeout(4000)
    const phaseAfterReverse = await page.evaluate(() =>
      (window as unknown as { __phase: () => string }).__phase(),
    )
    await shot(page, 'F_reverse_over_start_line')
    await page.keyboard.up('s')
    console.log(`  phase after reversing over the line: ${phaseAfterReverse} (must not be 'dry' or 'stopped')`)
    if (phaseAfterReverse === 'dry' || phaseAfterReverse === 'stopped') {
      console.error(
        `  FAIL  reversing over the start/finish line changed phase to '${phaseAfterReverse}': ` +
          'invariant 1/2 broken at the app level',
      )
    }

    // Glassmorphism re-check: PERF GUARD fps with the restored real
    // backdrop-filter (Block F reversed Block D's flatten-to-SURFACE_FLAT
    // decision on explicit request).
    await page.keyboard.up('w')
    await page.keyboard.up('s')
    await page.evaluate(() => (window as unknown as { __warpTo: (id: string) => void }).__warpTo('projects'))
    await waitPhase(page, 'stopped', 6000)
    await page.waitForTimeout(500)
    await shot(page, 'F_glass_card_recheck')
    const glassFps = await fps(page)
    console.log(`  fps with restored glass card open: ${glassFps.toFixed(1)}`)
  }

  if (block === 'G') {
    // Fresh context (no localStorage), so tutorialSeen is false and the
    // onboarding card covers the DRIVER screen exactly as a first visit would.
    await shot(page, 'G_tutorial')

    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
    await shot(page, 'G_driver_after_enter')

    await holdKey(page, 'w', 80)
    await waitPhase(page, 'driving', 6000)
    await page.keyboard.down('w')
    await page.waitForTimeout(2500)
    await shot(page, 'G_timer_running')

    // Force a slide with SPACE + steer, the reliable trigger for a scripted
    // run (the natural trigger depends on hitting an actual corner at the
    // right instant). Hold long enough for smoke to spawn and skid marks to
    // accumulate a visible trail.
    await page.keyboard.down('d')
    await page.keyboard.down(' ')
    await page.waitForTimeout(500)
    await shot(page, 'G_drift_smoke')
    await page.waitForTimeout(1500)
    await shot(page, 'G_skidmarks')
    await page.keyboard.up(' ')
    await page.keyboard.up('d')
    await page.keyboard.up('w')

    await page.evaluate(() => (window as unknown as { __warpTo: (id: string) => void }).__warpTo('contact'))
    await waitPhase(page, 'dry', 6000)
    await page.waitForTimeout(500)
    await shot(page, 'G_contact_lap_and_drift')

    await page.evaluate(() => (window as unknown as { __warpTo: (id: string) => void }).__warpTo('projects'))
    await waitPhase(page, 'stopped', 6000)
    await page.waitForTimeout(500)
    await shot(page, 'G_card_glass')
    await page.mouse.move(760, 420, { steps: 12 })
    await page.waitForTimeout(200)
    await shot(page, 'G_card_hover')

    await browser.close()

    // --- mobile: a separate context at 390x844 with touch emulated, so
    // `(pointer: coarse)` actually matches the way it would on a phone ---
    const mobileBrowser = await chromium.launch({ headless: false })
    const mobilePage = await mobileBrowser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    })
    mobilePage.on('console', (msg) => {
      if (msg.type() === 'error') console.error('  [mobile console error]', msg.text())
    })
    await mobilePage.goto(BASE, { waitUntil: 'load' })
    await mobilePage.waitForSelector('canvas', { timeout: 15000 })
    await waitCarLoaded(mobilePage)
    await mobilePage.waitForTimeout(300)
    await shot(mobilePage, 'G_mobile_tutorial')

    // The tutorial dismisses only on ITS OWN button, never a stray tap
    // elsewhere (see Car.tsx's onTap guard and its own comment: a tap that
    // missed both buttons used to launch the car underneath the still-open
    // card). A second, separate tap actually starts the drive.
    await mobilePage.getByText('Tap to continue').tap()
    await mobilePage.waitForTimeout(300)
    await mobilePage.tap('body')
    await waitPhase(mobilePage, 'driving', 8000)
    await mobilePage.waitForTimeout(2000)
    await shot(mobilePage, 'G_mobile_driving')

    await waitPhase(mobilePage, 'stopped', 20000)
    await mobilePage.waitForTimeout(500)
    await shot(mobilePage, 'G_mobile_card')

    await mobileBrowser.close()
    console.log('done')
    return
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
