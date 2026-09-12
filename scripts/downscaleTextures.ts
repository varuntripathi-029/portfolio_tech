/**
 * Downscales the four shipped ground texture sets from 1K to 512, per spec
 * 12.1's "two outstanding items" list: the ground textures were flagged for
 * this in v1 and it never happened, so `public/textures` shipped the full 1K
 * Poly Haven originals as-is.
 *
 *   npx tsx scripts/downscaleTextures.ts
 *
 * The 1K masters stay in `assets/2d/textures/` untouched; this only rewrites
 * the shipped copies under `public/`. `asphalt_pit_lane` is not in this list
 * on purpose: it was already never copied into `public/` (nothing in the
 * scene references it, see spec 2 and 12.1), so there is nothing to delete
 * there beyond the untouched `assets/` source, which stays as an unused
 * master and costs nothing shipped.
 */

import ffmpegPath from 'ffmpeg-static'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const SETS = ['asphalt_track', 'concrete_pavement', 'gravel_floor_02', 'sparse_grass']
const SIZE = 512

for (const set of SETS) {
  const dir = `public/textures/${set}`
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.jpg')) continue
    const path = `${dir}/${file}`
    const tmp = `${dir}/${file}.tmp.jpg`
    execFileSync(ffmpegPath as unknown as string, [
      '-y',
      '-i',
      path,
      '-vf',
      `scale=${SIZE}:${SIZE}`,
      '-q:v',
      '3',
      tmp,
    ])
    execFileSync('mv', ['-f', tmp, path])
    console.log(`  ${path} -> ${SIZE}x${SIZE}`)
  }
}

console.log('done')
