/**
 * Drives one full lap headless and reports on it.
 *
 *   npx tsx scripts/simulateLap.ts
 *
 * This is the acceptance test for Stage 2, and it exists because the automated
 * browser cannot run a frame loop (see src/sim/car.ts). Exits non-zero if the
 * lap is too slow, a stop misses its marker, or a geometry assertion fails.
 */

import { TRACK_LENGTH, curvatureAt, frameAt, wrapS } from '../src/track/trackFrame'
import { assertCircuit, assertPropClearance, assertPropsOutside } from '../src/track/assertions'
import { collectProps, collectOutsideProps } from '../src/track/props'
import { SECTIONS, BRAKING_STOPS } from '../src/data/sections'
import { RESOLVED } from '../src/track/circuit'
import {
  createCarState,
  stepCar,
  cornerSpeed,
  TOP_SPEED,
  REVERSE_TOP_SPEED,
  REVERSE_GEAR,
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
    handbrake: false,
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
    handbrake: false,
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
    handbrake: false,
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
    handbrake: false,
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

// --- drift-heavy run (Block F): confirm the steer limit still holds, and
// report the time cost of drifting every corner rather than gripping it ---
//
// The "grip lap" above steers not at all (pure understeer plus a lift before
// the one corner that needs it), so it is not a fair baseline for isolating
// what drifting itself costs: active steering into a corner is simply a
// different, more capable line regardless of the handbrake. Instead this
// drives the SAME steer-hard-into-every-corner style twice, once with the
// handbrake and once without, so the only variable between the two runs is
// drifting itself.

function driveOneLap(withHandbrake: boolean) {
  const dcar = createCarState(0)
  let time = 0
  let maxAbsD = 0
  let maxSlip = 0
  let breached = false
  const startTravelled = dcar.travelled
  while (dcar.travelled - startTravelled < TRACK_LENGTH && time < SIM_LIMIT) {
    const curvature = curvatureAt(dcar.s)
    const cornering = Math.abs(curvature) > 1e-4
    const input: CarInput = {
      throttle: true,
      brake: false,
      steer: cornering ? Math.sign(curvature) : 0,
      targetS: null,
      steerEnabled: true,
      handbrake: withHandbrake && cornering,
    }
    stepCar(dcar, input, DT, track)
    time += DT
    maxAbsD = Math.max(maxAbsD, Math.abs(dcar.d))
    maxSlip = Math.max(maxSlip, Math.abs(dcar.slipAngle))
    if (Math.abs(dcar.d) > STEER_LIMIT + 1e-6) breached = true
  }
  return { time, maxAbsD, maxSlip, breached }
}

console.log('\ndrift-heavy lap')
{
  const withDrift = driveOneLap(true)
  const withoutDrift = driveOneLap(false)
  console.log(`  same line, handbrake off   ${withoutDrift.time.toFixed(2)}s`)
  console.log(
    `  same line, handbrake on    ${withDrift.time.toFixed(2)}s   ` +
      `(drifting costs ${(withDrift.time - withoutDrift.time).toFixed(2)}s over the lap)`,
  )
  console.log(`  max |d| reached            ${withDrift.maxAbsD.toFixed(2)}m of ${STEER_LIMIT.toFixed(2)}m available`)
  console.log(`  max slip angle             ${withDrift.maxSlip.toFixed(1)} deg`)
  if (withDrift.breached) {
    fail('drifting pushed the car past STEER_LIMIT: a drift left the track')
  }
  if (withDrift.time <= withoutDrift.time) {
    fail('drifting was not slower than the identical line without it: it is a shortcut, not style')
  }
}

// --- sustained slide through every named corner (Block G): initiate with a
// lift, sustain under throttle the whole way through, and confirm the car
// loses under 25% of its corner-entry speed doing it ---

console.log('\nsustained slide per corner')
{
  const designTotal = RESOLVED.reduce((a, r) => a + r.length, 0)
  const toMeasured = TRACK_LENGTH / designTotal
  const corners = RESOLVED.filter((r) => r.kind === 'arc')
  let worstLossPct = 0

  for (const corner of corners) {
    const startS = corner.start * toMeasured
    const lengthS = corner.length * toMeasured
    // A comparable "entered hot" speed for every corner: 25% over its own
    // grip limit, which is exactly the kind of entry that needs a slide
    // rather than a lift to get through clean.
    const limit = cornerSpeed(1 / corner.radius)
    const car = createCarState(wrapS(startS))
    car.v = Math.min(TOP_SPEED, limit * 1.25)
    const entrySpeed = car.v
    const steer = corner.turn >= 0 ? 1 : -1

    // Initiate with a brief lift-and-steer, then sustain under throttle for
    // the rest of the corner's own length (not a step beyond it, or an
    // accelerating slide would keep gaining speed past the exit and the
    // comparison would stop meaning anything).
    let traversed = 0
    let t = 0
    while (traversed < lengthS && t < 15) {
      const initiating = t < 0.4
      const cmd: CarInput = {
        throttle: !initiating,
        brake: false,
        steer,
        targetS: null,
        steerEnabled: true,
        handbrake: false,
      }
      stepCar(car, cmd, DT, track)
      traversed += car.v * DT
      t += DT
    }
    const exitSpeed = car.v
    const lossPct = Math.max(0, (1 - exitSpeed / entrySpeed) * 100)
    worstLossPct = Math.max(worstLossPct, lossPct)
    console.log(
      `  ${corner.id.padEnd(14)} entry ${(entrySpeed * 3.6).toFixed(0)} km/h -> ` +
        `exit ${(exitSpeed * 3.6).toFixed(0)} km/h (${lossPct.toFixed(1)}% lost), ` +
        `reached ${car.driftPhase}`,
    )
    if (lossPct >= 25) {
      fail(`sustained slide through "${corner.id}" lost ${lossPct.toFixed(1)}% of entry speed, over the 25% limit`)
    }
  }
  console.log(`  worst speed loss across all corners: ${worstLossPct.toFixed(1)}%`)
}

// --- reverse gear (Block F / F5): engagement timing, top speed, and the
// four invariants the forward-only code assumed ---

console.log('\nreverse gear')
{
  const rcar = createCarState(50) // start a little way into the lap, away from s=0
  const holdBrake: CarInput = {
    throttle: false,
    brake: true,
    steer: 0,
    targetS: null,
    steerEnabled: true,
    handbrake: false,
  }

  // 1. Engagement timing: brake to a stop, then hold S. Reverse must not
  // engage before REVERSE_ENGAGE_TIME (0.3s), and must engage shortly after.
  let t = 0
  while (rcar.v > 0.05 && t < 20) {
    stepCar(rcar, holdBrake, DT, track)
    t += DT
  }
  let engagedAt = -1
  t = 0
  while (t < 1 && engagedAt < 0) {
    stepCar(rcar, holdBrake, DT, track)
    t += DT
    if (rcar.reversing) engagedAt = t
  }
  console.log(`  reverse engaged after   ${engagedAt.toFixed(2)}s of holding S stationary (target ~0.3)`)
  if (engagedAt < 0.25 || engagedAt > 0.45) {
    fail(`reverse engaged at ${engagedAt.toFixed(2)}s, expected close to the 0.3s hold`)
  }

  // 2. Top speed cap: hold S (the reverse "gas") and confirm it never
  // exceeds REVERSE_TOP_SPEED.
  let maxReverseSpeed = 0
  t = 0
  while (t < 15) {
    stepCar(rcar, holdBrake, DT, track)
    t += DT
    maxReverseSpeed = Math.max(maxReverseSpeed, rcar.v)
  }
  console.log(
    `  reverse top speed       ${(maxReverseSpeed * 3.6).toFixed(1)} km/h ` +
      `(cap ${(REVERSE_TOP_SPEED * 3.6).toFixed(1)})`,
  )
  if (maxReverseSpeed > REVERSE_TOP_SPEED + 0.01) {
    fail(`reverse exceeded its top speed cap: ${(maxReverseSpeed * 3.6).toFixed(1)} km/h`)
  }
  if (rcar.gear !== REVERSE_GEAR) fail('gear did not read as REVERSE_GEAR while reversing')

  // Invariant 1 & 2: reversing back across the start/finish line must not
  // fire an arrival even when fed a real target -- the sim's own arrival
  // snap must refuse to fire while `state.reversing` is true, not just rely
  // on Car.tsx never handing it a target during reverse. This is the
  // stronger, sim-level version of "only a forward crossing ends anything".
  // Fresh car, parked right next to the line, so a short reverse run is
  // guaranteed to wrap it rather than depending on how far the earlier
  // engagement/top-speed checks happened to travel.
  const lcar = createCarState(5)
  // Engagement itself requires targetS === null (reverse is a free-driving
  // manoeuvre, never available with a stop armed), so engage first...
  t = 0
  while (t < 1 && !lcar.reversing) {
    stepCar(lcar, holdBrake, DT, track)
    t += DT
  }
  if (!lcar.reversing) fail('reverse never engaged for the line-crossing scenario, the rest of it is meaningless')
  // ...then feed it a real target anyway, simulating the bug this invariant
  // guards against (arming somehow left on into a reverse manoeuvre), and
  // confirm the sim itself refuses to arrive on it while reversing.
  const fedTarget: CarInput = { throttle: false, brake: true, steer: 0, targetS: 5, steerEnabled: true, handbrake: false }
  let crossedLine = false
  let arrivedWhileReversing = false
  t = 0
  while (t < 12) {
    const { arrived } = stepCar(lcar, fedTarget, DT, track)
    if (arrived) arrivedWhileReversing = true
    if (lcar.s > TRACK_LENGTH - 20) crossedLine = true
    t += DT
  }
  console.log(
    `  reversed from s=5.0m to s=${lcar.s.toFixed(1)}m, ` +
      `crossing the line backward: ${crossedLine ? 'yes' : 'no'}`,
  )
  if (!crossedLine) fail('the reverse-across-the-line scenario never actually reached the line')
  if (arrivedWhileReversing) {
    fail('stepCar fired an arrival while reversing, even with a target fed to it: invariant 1/2 broken')
  }

  // Invariant 3: fuel is monotonic. Drive forward a while (fuel falls),
  // then reverse for a while, and confirm fuel never rises at any step.
  const fcar = createCarState(0)
  const driveForward: CarInput = {
    throttle: true,
    brake: false,
    steer: 0,
    targetS: null,
    steerEnabled: true,
    handbrake: false,
  }
  let lastFuel = fcar.fuel
  let fuelRose = false
  t = 0
  while (t < 20) {
    stepCar(fcar, driveForward, DT, track)
    if (fcar.fuel > lastFuel + 1e-9) fuelRose = true
    lastFuel = fcar.fuel
    t += DT
  }
  const fuelAfterDriving = fcar.fuel
  t = 0
  while (t < 20) {
    stepCar(fcar, holdBrake, DT, track) // brakes to a stop, then reverses
    if (fcar.fuel > lastFuel + 1e-9) fuelRose = true
    lastFuel = fcar.fuel
    t += DT
  }
  console.log(
    `  fuel after driving forward   ${fuelAfterDriving.toFixed(3)}, ` +
      `after reversing ${fcar.fuel.toFixed(3)} (must not have risen)`,
  )
  if (fuelRose) fail('fuel rose at some step without an explicit refuel: invariant 3 broken')
}

if (lapTime > MAX_LAP) {
  fail(`the lap took ${lapTime.toFixed(1)}s, over the ${MAX_LAP}s limit`)
}

console.log(failed ? '\nFAILED' : '\nOK')
process.exit(failed ? 1 : 0)
