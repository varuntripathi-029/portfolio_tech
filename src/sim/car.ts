/**
 * The car simulation. Pure numbers: no React, no three, no DOM.
 *
 * This is an architectural rule, not a preference. The automated browser in
 * this project backgrounds the tab it drives, which sets
 * `document.visibilityState` to hidden, and Chrome pauses
 * `requestAnimationFrame` outright for hidden tabs. `useFrame` never ticks, so
 * every attempt to verify driving behaviour through the browser during the v1
 * build failed, across three separate stages. Physics that can only be observed
 * at 60fps in a focused tab is physics that cannot be tested here.
 *
 * So the model lives in a function, and scripts/simulateLap.ts drives it in
 * Node. Car.tsx is a renderer that calls stepCar and places meshes.
 */

import { GRIP_G, G, REF_SPEED } from '../track/circuit'
import { RUMBLE_D, STEER_LIMIT, WHEEL_RADIUS } from './carSpec'

/** Top speed, about 305 km/h. */
export const TOP_SPEED = REF_SPEED

/**
 * Mass is a modelling choice, not a measurement. It only ever appears as a
 * divisor next to the force numbers below, which were tuned together to hit the
 * acceleration targets, so changing it alone changes nothing useful.
 */
const MASS = 800

/**
 * Acceleration limit from tyre grip, at a standstill.
 */
const LAUNCH_ACCEL = 12.6

/**
 * How much downforce adds to that limit, per (m/s)^2.
 *
 * Without this term the model cannot hit both acceleration targets. Drag only
 * ever reduces net acceleration, so a constant traction limit makes average
 * acceleration fall with speed, and the spec asks for 0 to 100 in 2.6s (average
 * 10.7) but 0 to 200 in 5.0s (average 11.1). Average acceleration has to RISE.
 * Real cars manage it because downforce grows with speed, so grip does too.
 */
const DOWNFORCE_K = 0.0018

/** Engine power in watts. With the drag below this sets the top speed. */
const POWER = 880000

/** Constant rolling resistance. */
const ROLL_DRAG = 200

/**
 * Aerodynamic drag coefficient, DERIVED so the car tops out at exactly
 * TOP_SPEED. At the top end the power-limited traction force is balanced by
 * drag plus rolling resistance, so k = (P / v - roll) / v^2.
 */
const DRAG_K = (POWER / TOP_SPEED - ROLL_DRAG) / (TOP_SPEED * TOP_SPEED)

/** Braking under S, in g. */
export const BRAKE_G = 4
/** Automatic braking into a section stop, in g. */
export const STOP_BRAKE_G = 5

const BRAKE_DECEL = BRAKE_G * G
const STOP_DECEL = STOP_BRAKE_G * G

/** Lateral grip available, in m/s^2. */
const GRIP = GRIP_G * G

// --- gearbox ---

export const GEAR_COUNT = 8
/** Road speed at the redline in first gear. */
const FIRST_GEAR_TOP = 12
const REDLINE_RPM = 12000
const IDLE_RPM = 2500
const SHIFT_UP_RPM = 11500
const SHIFT_DOWN_RPM = 5600
/** Torque cut per shift, in seconds. */
const SHIFT_CUT = 0.08

/**
 * Road speed at the redline in each gear, geometric from first to top so every
 * gear covers the same proportional speed band.
 */
const GEAR_TOP: number[] = (() => {
  const ratio = Math.pow(TOP_SPEED / FIRST_GEAR_TOP, 1 / (GEAR_COUNT - 1))
  const out: number[] = []
  for (let i = 0; i < GEAR_COUNT; i++) out.push(FIRST_GEAR_TOP * Math.pow(ratio, i))
  return out
})()

// --- steering ---

const STEER_ACCEL = 26
const STEER_RETURN = 18
const STEER_MAX_V = 8
/** Road speed at which steering reaches full authority. */
const STEER_GRIP_SPEED = 20

/**
 * How hard understeer pushes the car wide, and how much speed it scrubs.
 *
 * Tuned against the one lift corner: R115 flat out at 85 m/s asks for 62.8
 * m/s^2 of lateral grip against the 44.1 available, so the excess is 42% of
 * grip. That drifts the car about 2.5 m/s sideways and scrubs about 4.7 m/s^2,
 * which is enough to reach the kerb from the middle of the road over the
 * corner. The corner is flat out below about 71 m/s, so the lift is real.
 */
const DRIFT_GAIN = 6
const SCRUB_K = 0.25

/**
 * How fast the car eases back off the kerb when nobody is steering, in m/s.
 *
 * Lateral speed decays but lateral POSITION does not recentre, which is the
 * right call for a line the reader chose. It is the wrong call for a line
 * understeer chose: without this, one moment of running wide parks the car on
 * the kerb for the rest of the lap and the rumble never stops. Measured in the
 * sim: 15 seconds of continuous kerb per lap before this existed.
 *
 * It only pulls while a wheel is actually over the kerb, so any line on the
 * asphalt is still held exactly.
 */
const KERB_RETURN = 1.5

/**
 * How far inside the kerb the return settles. Without the margin the pull
 * stops exactly on the trigger threshold, the outer wheel stays in contact,
 * and the rumble runs forever anyway: measured at 15.01s per lap either way.
 */
const KERB_CLEARANCE = 0.6

/** Smoothing for the pitch and roll readouts, per second. */
const LEAN_SMOOTH = 9
/** Longitudinal acceleration that reads as full pitch. */
const PITCH_REF = STOP_DECEL
/** Lateral acceleration that reads as full roll. */
const ROLL_REF = GRIP

/**
 * Guard for every divisor taken from frame time.
 *
 * Two frames inside the same millisecond give dt 0, and 0/0 is NaN. Because
 * pitch and roll are smoothed accumulators, one such frame froze the car roll
 * and both front wheels for the rest of the session during the v1 build.
 */
const MIN_DT = 1e-4

export interface CarState {
  /** Arc length along the lap, metres. */
  s: number
  /** Lateral offset from the racing line. Positive is the driver left. */
  d: number
  /** Forward speed, m/s. */
  v: number
  /** Lateral speed, m/s. */
  vd: number
  gear: number
  rpm: number
  /** 1 at the line, 0 at the CONTACT marker. */
  fuel: number
  /** Seconds of torque cut remaining from the last shift. */
  shiftCut: number
  /** Accumulated wheel rotation, radians. */
  wheelAngle: number
  /** Signed longitudinal acceleration, m/s^2. Negative under braking. */
  accelLong: number
  /** Signed lateral acceleration, m/s^2. */
  accelLat: number
  /** Smoothed -1..1 pitch target. Positive is nose down. */
  pitch: number
  /** Smoothed -1..1 roll target. */
  roll: number
  /** True while any brake is applied, for the brake lights. */
  braking: boolean
  /** True while understeer is pushing the car wide. */
  understeer: boolean
  /** Total distance travelled, metres. Laps are not counted anywhere in the UI. */
  travelled: number
}

export interface CarInput {
  throttle: boolean
  brake: boolean
  /** -1 to 1. Positive steers toward the driver left. */
  steer: number
  /**
   * Arc length of the stop the car is braking for, or null while free driving.
   * When set, the car brakes itself to rest on the marker.
   */
  targetS: number | null
  /** False during the lights, a warp, or while stopped: A and D are ignored. */
  steerEnabled: boolean
}

export interface TrackQuery {
  length: number
  /** Signed curvature at an arc length, 1/metres. */
  curvatureAt(s: number): number
}

export function createCarState(s = 0): CarState {
  return {
    s,
    d: 0,
    v: 0,
    vd: 0,
    gear: 0,
    rpm: IDLE_RPM,
    fuel: 1,
    shiftCut: 0,
    wheelAngle: 0,
    accelLong: 0,
    accelLat: 0,
    pitch: 0,
    roll: 0,
    braking: false,
    understeer: false,
    travelled: 0,
  }
}

function clamp(x: number, lo: number, hi: number) {
  return x < lo ? lo : x > hi ? hi : x
}

/** Shortest forward distance from a to b around the loop. */
function forwardGap(a: number, b: number, length: number) {
  let d = (b - a) % length
  if (d < 0) d += length
  return d
}

/**
 * Engine force available at a road speed, before drag. The lower of what the
 * tyres can put down (grip, rising with downforce) and what the engine can
 * deliver (power / speed).
 */
function tractionAt(v: number) {
  const grip = MASS * (LAUNCH_ACCEL + DOWNFORCE_K * v * v)
  if (v < 0.5) return grip
  return Math.min(grip, POWER / v)
}

function updateGearbox(state: CarState, dt: number) {
  state.shiftCut = Math.max(0, state.shiftCut - dt)

  const top = GEAR_TOP[state.gear]
  const rpm = state.v <= 0.1 ? IDLE_RPM : Math.max(IDLE_RPM, (state.v / top) * REDLINE_RPM)
  state.rpm = Math.min(rpm, REDLINE_RPM)

  if (state.shiftCut > 0) return

  if (state.rpm >= SHIFT_UP_RPM && state.gear < GEAR_COUNT - 1) {
    state.gear++
    state.shiftCut = SHIFT_CUT
  } else if (state.rpm <= SHIFT_DOWN_RPM && state.gear > 0) {
    state.gear--
    state.shiftCut = SHIFT_CUT
  }
}

/**
 * Advances the car by dt. Mutates `state` in place, because this runs every
 * frame and allocating a new state object per frame is pure waste.
 *
 * Returns whether the car has come to rest on `input.targetS` this step.
 */
export function stepCar(
  state: CarState,
  input: CarInput,
  dt: number,
  track: TrackQuery,
): { arrived: boolean } {
  const step = Math.max(dt, MIN_DT)
  const vBefore = state.v
  let arrived = false

  // --- longitudinal ---

  const drag = DRAG_K * state.v * state.v + (state.v > 0.1 ? ROLL_DRAG : 0)
  let force = -drag

  // Automatic braking into a section stop. Braking begins v^2 / (2a) before
  // the marker, and the rate is recomputed from the distance remaining every
  // step, so the car lands on the marker rather than near it.
  let autoBrake = 0
  if (input.targetS !== null) {
    const remaining = forwardGap(state.s, input.targetS, track.length)
    const needed = (state.v * state.v) / (2 * STOP_DECEL)
    if (remaining <= needed || remaining < 1) {
      autoBrake = remaining > 0.01 ? (state.v * state.v) / (2 * remaining) : STOP_DECEL
      autoBrake = Math.min(autoBrake, STOP_DECEL * 4)
    }
  }

  if (autoBrake > 0) {
    force = -MASS * autoBrake - drag
    state.braking = true
  } else if (input.brake) {
    force = -MASS * BRAKE_DECEL - drag
    state.braking = true
  } else {
    state.braking = false
    if (input.throttle && state.shiftCut <= 0) force = tractionAt(state.v) - drag
  }

  state.v += (force / MASS) * step
  if (state.v < 0) state.v = 0
  if (state.v > TOP_SPEED) state.v = TOP_SPEED

  const advance = state.v * step
  state.s = (state.s + advance) % track.length
  state.travelled += advance

  if (input.targetS !== null) {
    const remaining = forwardGap(state.s, input.targetS, track.length)
    // Snap the last few centimetres. Without this the adaptive brake rate
    // chases an ever-smaller distance and never quite lands.
    if (state.v < 0.6 && (remaining < 0.4 || remaining > track.length - 0.4)) {
      state.s = input.targetS
      state.v = 0
      arrived = true
    }
  }

  // --- lateral ---

  const curvature = track.curvatureAt(state.s)
  const steer = input.steerEnabled ? clamp(input.steer, -1, 1) : 0

  if (steer !== 0) {
    state.vd = clamp(state.vd + steer * STEER_ACCEL * step, -STEER_MAX_V, STEER_MAX_V)
  } else {
    // Decays lateral speed but does not recentre: the reader picks a line and
    // the car holds it.
    const decay = STEER_RETURN * step
    state.vd = Math.abs(state.vd) <= decay ? 0 : state.vd - Math.sign(state.vd) * decay
  }

  // Steering authority follows road speed, so the car cannot slide sideways
  // off a standing start.
  const authority = Math.min(1, state.v / STEER_GRIP_SPEED)
  let dNext = state.d + state.vd * authority * step

  // Understeer. Heading always follows the tangent, so the consequence of
  // carrying too much speed into a corner is being pushed wide, never a spin.
  // The loop turns the same way at every corner, so the outside of the bend is
  // whichever side the curvature sign points at.
  const demand = state.v * state.v * Math.abs(curvature)
  const excess = demand - GRIP
  state.understeer = excess > 0
  if (excess > 0) {
    const drift = (excess / GRIP) * DRIFT_GAIN
    dNext += Math.sign(curvature) * drift * step
    state.v = Math.max(0, state.v - SCRUB_K * excess * step)
  }

  const kerbTarget = RUMBLE_D - KERB_CLEARANCE
  if (steer === 0 && Math.abs(dNext) > kerbTarget) {
    const pull = Math.min(KERB_RETURN * step, Math.abs(dNext) - kerbTarget)
    dNext -= Math.sign(dNext) * pull
  }

  const clamped = clamp(dNext, -STEER_LIMIT, STEER_LIMIT)
  // Pinned against the limit: drop the stored lateral momentum rather than
  // save it up to be released the moment the car comes off the edge.
  if (clamped !== dNext) state.vd = 0
  const dBefore = state.d
  state.d = clamped

  // --- readouts ---

  updateGearbox(state, step)

  state.fuel = clamp(1 - state.s / track.length, 0, 1)
  state.wheelAngle += (state.v / WHEEL_RADIUS) * step

  state.accelLong = (state.v - vBefore) / step
  // Lateral acceleration is the corner demand plus whatever the steering is
  // doing, signed so a left-hand bend and a left flick lean the same way.
  const lateralFromSteer = (state.d - dBefore) / step
  state.accelLat = state.v * state.v * curvature + lateralFromSteer

  const smooth = 1 - Math.exp(-LEAN_SMOOTH * step)
  const pitchTarget = clamp(-state.accelLong / PITCH_REF, -1, 1)
  const rollTarget = clamp(state.accelLat / ROLL_REF, -1, 1)
  state.pitch += (pitchTarget - state.pitch) * smooth
  state.roll += (rollTarget - state.roll) * smooth

  return { arrived }
}

/** Fastest speed a corner of this curvature can be taken without drifting wide. */
export function cornerSpeed(curvature: number): number {
  const k = Math.abs(curvature)
  return k < 1e-9 ? TOP_SPEED : Math.min(TOP_SPEED, Math.sqrt(GRIP / k))
}

/** Distance needed to brake to rest from a speed, at the section-stop rate. */
export function stopDistance(v: number): number {
  return (v * v) / (2 * STOP_DECEL)
}
