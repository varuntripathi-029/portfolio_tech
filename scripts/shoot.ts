/**
 * Captures the 6 LIVE project cards' screenshots and converts them to WebP.
 *
 *   npx tsx scripts/shoot.ts
 *
 * Per spec 1.8: 1440x900 viewport, settle after load, then convert to .webp
 * at q~78, 1024x640 (which is exactly the viewport's own 1.6:1 aspect ratio,
 * so the scale is a plain resize with no crop and no distortion).
 *
 * HireSignal and MX_rating sit behind Google OAuth (spec 1.8's own note), so
 * an unattended run captures whatever their public landing route renders
 * (marketing copy or a "sign in" prompt), not an authenticated dashboard.
 * That is the documented, accepted outcome for an automated capture; see
 * FINAL2_NOTES.md.
 */

import { chromium } from 'playwright'
import ffmpegPath from 'ffmpeg-static'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { PROJECTS } from '../src/data/content'

const OUT_DIR = 'public/projects'
const TMP_DIR = 'verify/shoot-tmp'

mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(TMP_DIR, { recursive: true })

async function main() {
  const targets = PROJECTS.filter((p) => p.visualKind === 'screenshot' && p.liveUrl)

  // Same headed-Chromium requirement as verify.ts: headless rAF throttling on
  // this machine would starve any client-side animation on the target site
  // before the settle wait is up, not just this project's own scene.
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  for (const project of targets) {
    const pngPath = `${TMP_DIR}/${project.id}.png`
    const webpPath = `${OUT_DIR}/${project.id}.webp`
    try {
      console.log(`shooting ${project.id}: ${project.liveUrl}`)
      await page.goto(project.liveUrl!, { waitUntil: 'load', timeout: 30000 })
      await page.waitForTimeout(2500) // settle for entrance animations
      await page.screenshot({ path: pngPath })
      execFileSync(ffmpegPath as unknown as string, [
        '-y',
        '-i',
        pngPath,
        '-vf',
        'scale=1024:640',
        '-c:v',
        'libwebp',
        '-quality',
        '78',
        webpPath,
      ])
      console.log(`  wrote ${webpPath}`)
    } catch (err) {
      console.error(`  FAILED ${project.id}:`, (err as Error).message)
    }
  }

  await browser.close()
  rmSync(TMP_DIR, { recursive: true, force: true })
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
