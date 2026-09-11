/**
 * Drives one full lap headless and reports on it.
 *
 *   npx tsx scripts/simulateLap.ts
 *
 * This is the acceptance test for Stage 2, and it exists because the automated
 * browser cannot run a frame loop (see src/sim/car.ts). Exits non-zero if the
 * lap is too slow, a stop misses its marker, or a geometry assertion fails.
 */

import { TRACK_LENGTH, curvatureAt, frameAt } from '../src/track/trackFrame'
import { assertCircuit, assertPropClearance, assertPropsOutside } from '../src/track/assertions'
import { collectProps, collectOutsideProps } from '../src/track/props'
import { SECTIONS, BRAKING_STOPS } from '../src/data/sections'
import { RESOLVED } from '../src/track/circuit'
import {
  createCarState,
  stepCar,
  cornerSpeed,
  TOP_SPEED,
  type CarInput,
} from '../src/sim/car'
import { STEER_LIMIT, RUMBLE_D } from '../src/sim/carSpec'

/** Physics step. Fixed and small, so the report is not a function of frame rate. */
const DT = 1 / 240
/** A lap this long means the circuit is wrong, not the driving. */
const MAX_LAP = 150
/** Every stop must land this close to its marker. */
const STOP_TOLERANCE = 0.5
/** Runaway guard, in simulated seconds. */
const SIM_LIMIT = 400

const track = { length: TRACK_LENGTH, curvatureAt }

let failed = false
function fail(message: string) {
  failed = true
  console.error(`  FAIL  ${message}`)
}

// --- geometry first: a bad circuit makes the lap time meaningless ---

console.log('circuit')
try {
  const checks = assertCircuit()
  const clearance = assertPropClearance(collectProps())
  assertPropsOutside(collectOutsideProps())
  console.log(`  length            ${TRACK_LENGTH.toFixed(1)}m`)
  console.log(`  separation        ${checks.separation.toFixed(1)}m`)
  console.log(`  prop clearance    ${clearance.toFixed(1)}m`)
  console.log('  outside props     all confirmed outside by winding number')
  const lift = checks.radii.filter((r) => r.lift)
  console.log(
    `  corners           ${checks.radii
      .map((r) => `${r.id} R${r.measuredRadius.toFixed(0)}${r.lift ? '(lift)' : ''}`)
      .join(', ')}`,
  )
  console.log(
    `  lift corner speed ${lift
      .map((r) => `${(cornerSpeed(1 / r.measuredRadius) * 3.6).toFixed(0)} km/h`)
      .join(', ')}`,
  )
} catch (e) {
  fail(String((e as Error).message))
}

// --- standing start figures ---

console.log('\nacceleration')
{
  const car = createCarState(0)
  const input: CarInput = {
    throttle: true,
    brake: false,
    steer: 0,
    targetS: null,
    steerEnabled: false,
  }
  let t = 0
  let to100 = -1
  let to200 = -1
  let shifts = 0
  let gear = car.gear
  while (t < 30) {
    stepCar(car, input, DT, track)
    t += DT
    if (car.gear !== gear) {
      shifts++
      gear = car.gear
    }
    if (to100 < 0 && car.v * 3.6 >= 100) to100 = t
    if (to200 < 0 && car.v * 3.6 >= 200) to200 = t
    if (to200 > 0 && car.v > TOP_SPEED - 0.05) break
  }
  console.log(`  0 to 100 km/h     ${to100.toFixed(2)}s   (target ~2.6)`)
  console.log(`  0 to 200 km/h     ${to200.toFixed(2)}s   (target ~5.0)`)
  console.log(`  top speed         ${(car.v * 3.6).toFixed(0)} km/h`)
  console.log(`  shifts to top     ${shifts} of ${8 - 1}`)
  if (to100 < 0 || to200 < 0) fail('the car never reached 200 km/h')
}

// --- the lap ---

console.log('\nlap')

interface StopResult {
  id: string
  error: number
  at: number
}

const car = createCarState(0)
// A lift is only needed where the corner demands it, so the sim drives the
// track the way the brief describes a reader driving it: throttle pinned, and
// braking only for the corner it cannot take flat.
const LOOKAHEAD = 140

function wantsLift(s: number, v: number): boolean {
  for (let ahead = 0; ahead <= LOOKAHEAD; ahead += 2) {
    const limit = cornerSpeed(curvatureAt(s + ahead))
    if (limit >= v) continue
    // Can the car still slow to `limit` in the distance remaining?
    const needed = (v * v - limit * limit) / (2 * 4 * 9.81)
    if (needed >= ahead - 2) return true
  }
  return false
}

const stops: StopResult[] = []
const segmentTimes: { id: string; seconds: number }[] = []
let topSpeed = 0
let maxLatG = 0
let closestToLimit = Infinity
let shiftCount = 0
let gear = car.gear
let t = 0
let simTime = 0

let stopIndex = 0
let segStart = 0
let segIndex = 0

const order = BRAKING_STOPS

while (stopIndex < order.length && simTime < SIM_LIMIT) {
  const target = order[stopIndex]
  const input: CarInput = {
    throttle: !wantsLift(car.s, car.v),
    brake: wantsLift(car.s, car.v),
    steer: 0,
    targetS: target.s,
    steerEnabled: false,
  }
  const { arrived } = stepCar(car, input, DT, track)
  t += DT
  simTime += DT

  topSpeed = Math.max(topSpeed, car.v)
  maxLatG = Math.max(maxLatG, Math.abs(car.accelLat) / 9.81)
  closestToLimit = Math.min(closestToLimit, STEER_LIMIT - Math.abs(car.d))
  if (car.gear !== gear) {
    shiftCount++
    gear = car.gear
  }

  // Record which resolved segment the car is in, for the per-segment split.
  while (
    segIndex < RESOLVED.length - 1 &&
    car.s >= RESOLVED[segIndex + 1].start * (TRACK_LENGTH / RESOLVED.reduce((a, r) => a + r.length, 0))
  ) {
    segmentTimes.push({ id: RESOLVED[segIndex].id, seconds: t - segStart })
    segStart = t
    segIndex++
  }

  if (arrived) {
    const error = Math.abs(car.s - target.s)
    stops.push({ id: target.id, error, at: t })
    if (error > STOP_TOLERANCE) {
      fail(`stop "${target.id}" missed its marker by ${error.toFixed(3)}m`)
    }
    stopIndex++
    // Reader dismisses the card instantly: no reading time in this figure.
  }
}

if (stopIndex < order.length) {
  fail(`the car never reached stop "${order[stopIndex].id}" within ${SIM_LIMIT}s`)
}

// Roll the remaining 40m over the line to close the lap.
{
  const input: CarInput = {
    throttle: true,
    brake: false,
    steer: 0,
    targetS: null,
    steerEnabled: false,
  }
  const startS = car.s
  while (car.s >= startS && simTime < SIM_LIMIT) {
    stepCar(car, input, DT, track)
    t += DT
    simTime += DT
  }
}

const lapTime = t

console.log(`  lap, no reading   ${lapTime.toFixed(2)}s   (limit ${MAX_LAP}, target ~75)`)
console.log(`  top speed         ${(topSpeed * 3.6).toFixed(0)} km/h`)
console.log(`  gear shifts       ${shiftCount}`)
console.log(`  max lateral       ${maxLatG.toFixed(2)}g   (grip 4.50)`)
console.log(
  `  closest to limit  ${closestToLimit.toFixed(2)}m of margin ` +
    `(steer limit ${STEER_LIMIT.toFixed(2)}m, rumble at ${RUMBLE_D.toFixed(2)}m)`,
)

console.log('\nstops')
for (const stop of stops) {
  console.log(
    `  ${stop.id.padEnd(14)} error ${stop.error.toFixed(3)}m   reached at ${stop.at.toFixed(1)}s`,
  )
}
for (const sec of SECTIONS) {
  const fr = frameAt(sec.s)
  const radius = Math.abs(fr.curvature) > 1e-9 ? 1 / Math.abs(fr.curvature) : Infinity
  console.log(
    `  ${sec.id.padEnd(14)} s=${sec.s.toFixed(1).padStart(8)}m  ` +
      `radius ${radius === Infinity ? 'straight' : radius.toFixed(0) + 'm'}`,
  )
}

console.log('\nsegments')
for (const seg of segmentTimes) {
  console.log(`  ${seg.id.padEnd(22)} ${seg.seconds.toFixed(2)}s`)
}

// --- understeer pass: flat out with no lift, to exercise the consequence ---

console.log('\nundersteer, flat out with no lift')
{
  const bold = createCarState(0)
  const input: CarInput = {
    throttle: true,
    brake: false,
    steer: 0,
    targetS: null,
    steerEnabled: true,
  }
  let time = 0
  let maxDrift = 0
  let onKerb = 0
  let maxScrub = 0
  let lastV = 0
  // Two laps: the first builds up to speed, the second is the measurement.
  while (time < 200 && bold.travelled < TRACK_LENGTH * 2) {
    stepCar(bold, input, DT, track)
    time += DT
    if (bold.travelled > TRACK_LENGTH) {
      maxDrift = Math.max(maxDrift, Math.abs(bold.d))
      if (Math.abs(bold.d) >= RUMBLE_D) onKerb += DT
      if (bold.understeer) maxScrub = Math.max(maxScrub, lastV - bold.v)
    }
    lastV = bold.v
  }
  console.log(`  max drift         ${maxDrift.toFixed(2)}m of ${STEER_LIMIT.toFixed(2)}m available`)
  console.log(`  time on the kerb  ${onKerb.toFixed(2)}s   (outer wheel past ${RUMBLE_D.toFixed(2)}m)`)
  console.log(`  slowest point     ${(cornerSpeed(1 / 115) * 3.6).toFixed(0)} km/h is the lift-corner limit`)
  if (maxDrift < RUMBLE_D) {
    fail(
      `driving flat out never pushed the car past ${RUMBLE_D.toFixed(2)}m, so the kerb rumble is ` +
        'unreachable and the lift corner has no consequence',
    )
  }
}

if (lapTime > MAX_LAP) {
  fail(`the lap took ${lapTime.toFixed(1)}s, over the ${MAX_LAP}s limit`)
}

console.log(failed ? '\nFAILED' : '\nOK')
process.exit(failed ? 1 : 0)
