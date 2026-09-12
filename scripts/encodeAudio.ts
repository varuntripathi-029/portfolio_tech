/**
 * Converts the six raw engine loops to mono OGG at 96 kbps.
 *
 *   npx tsx scripts/encodeAudio.ts
 *
 * Uses the `ffmpeg-static` npm package rather than a system `ffmpeg`, per the
 * spec's resolved budget decision (1.7): the binary ships as a dev dependency,
 * so the conversion is reproducible on any machine and the "ffmpeg is not
 * installed" blocker from v1 does not recur. Masters stay in
 * assets/audio/raw/; only the compressed files ship from public/audio/.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import ffmpegPath from 'ffmpeg-static'

const SRC_DIR = 'assets/audio/raw'
const OUT_DIR = 'public/audio'

mkdirSync(OUT_DIR, { recursive: true })

let totalIn = 0
let totalOut = 0

for (let i = 0; i < 6; i++) {
  const src = `${SRC_DIR}/loop_${i}.wav`
  const out = `${OUT_DIR}/loop_${i}.ogg`
  if (!existsSync(src)) throw new Error(`encodeAudio: missing ${src}`)

  execFileSync(ffmpegPath as unknown as string, [
    '-y',
    '-i', src,
    '-ac', '1', // mono: Web Audio only spatialises mono sources anyway
    '-c:a', 'libvorbis',
    '-b:a', '96k',
    out,
  ])

  const inSize = statSync(src).size
  const outSize = statSync(out).size
  totalIn += inSize
  totalOut += outSize
  console.log(`  loop_${i}.wav  ${(inSize / 1024).toFixed(1)}KB -> loop_${i}.ogg  ${(outSize / 1024).toFixed(1)}KB`)
}

console.log(`\ntotal ${(totalIn / 1024).toFixed(1)}KB -> ${(totalOut / 1024).toFixed(1)}KB`)
