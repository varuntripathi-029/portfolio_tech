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

// --- reverse (Block F / F5) ---

/** ~25 km/h, per the brief. */
export const REVERSE_TOP_SPEED = 25 / 3.6
/** Reverse's own acceleration, in m/s^2: gentle, there is no gearbox to help. */
const REVERSE_ACCEL = 3.5
/** How long S must be held stationary before reverse engages. */
const REVERSE_ENGAGE_TIME = 0.3
/** Below this speed the car counts as "stopped" for engaging reverse. */
const REVERSE_ENGAGE_SPEED = 0.15
/** Sentinel gear value Dashboard reads as "R". Never a valid forward index. */
export const REVERSE_GEAR = -1

/**
 * Braking under S, in g.
 *
 * REVERSED: spec 6.2 says "about 4g". Block F's own brief asks for braking
 * "just a little more harder" specifically so trail-braking into a corner
 * has enough weight transfer to feed the natural oversteer trigger below;
 * 4g read as too gentle for that to land. 4.6g is the new value.
 */
export const BRAKE_G = 4.6
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

// --- drifting (Block F) ---

/** Handbrake only breaks rear traction above this speed. Below it the wheels
 * are already slow enough that "breaking traction" reads as nothing at all. */
const DRIFT_MIN_SPEED = 60 / 3.6

/** The slip angle a drift builds toward, in degrees, before A/D modulation. */
const SLIP_BASE_DEG = 12
/** How much A/D can push the target up or down from the base, in degrees.
 * Steering into the slide tightens it toward SLIP_BASE_DEG + this; steering
 * against it loosens the car back toward straight. */
const SLIP_MODULATE_DEG = 8
const SLIP_MAX_DEG = 20

/** How fast the slip angle builds toward its target while the handbrake is
 * held, per second. No overshoot on the way in: the car settles into a slide,
 * it does not snap into one. */
const SLIP_BUILD_RATE = 4

/**
 * Recovery on release is a lightly underdamped spring, not a plain decay,
 * so the nose swings very slightly past straight before settling: "a small
 * overshoot so the car feels weighted", per the brief. Critical damping at
 * this spring constant is 2*sqrt(90) =~ 19; 9 sits comfortably under that.
 */
const SLIP_SPRING_K = 90
const SLIP_DAMPING = 9

/** Degrees below which a recovering slip just snaps to zero, so it does not
 * ring forever at a fraction of a degree. */
const SLIP_SETTLE_DEG = 0.05
const SLIP_SETTLE_VEL = 0.5

/** How much the slide itself pushes the car sideways, layered on top of
 * whatever A/D is already doing through the normal steer model. */
const DRIFT_LATERAL_K = 0.06
/** How much holding a slide scrubs speed: style, not a shortcut. */
const DRIFT_SCRUB_K = 0.15
/** Score per (degree of slip * m/s of speed * second). Arbitrary, tuned only
 * so the popup shows a few hundred points for a good corner, not four digits. */
const DRIFT_SCORE_K = 1

/**
 * Natural (unforced) oversteer, added after the first drift pass shipped
 * with only the SPACE-forced version: turning in hard while lifting or
 * braking shifts weight off the rear axle, and the tail steps out on its
 * own, same as a real car trail-braking into a corner. SPACE still forces a
 * slide anywhere, at the larger SLIP_* range above; this is the smaller,
 * cornering-only range that needs no handbrake at all.
 */
const NATURAL_STEER_THRESHOLD = 0.5
const NATURAL_CURVATURE_THRESHOLD = 1e-3
const NATURAL_SLIP_BASE_DEG = 7
const NATURAL_SLIP_MODULATE_DEG = 6
const NATURAL_SLIP_MAX_DEG = 14

/**
 * Block G: GRIP -> INITIATE -> SLIDE -> RECOVER.
 *
 * The first drift pass conflated "what starts a slide" with "what keeps it
 * going", so pressing W (the natural trigger required lift-or-brake) or
 * holding S (which unconditionally overrode throttle at full 4.6g) both
 * ended it immediately. Real drifting is initiated by a lift or a brake and
 * SUSTAINED by throttle, so the two need to be different conditions, which
 * means the sim needs to know which one it is in.
 */
export type DriftPhase = 'grip' | 'initiate' | 'slide' | 'recover'

/** Slip angle at which an initiating slide counts as properly established. */
const SLIDE_ENTER_DEG = 3
/** Throttle during a slide drives at reduced traction, not full grip -- the
 * rear is already stepping out, so not all of the power goes to forward bite. */
const SLIDE_THROTTLE_TRACTION = 0.7
/** How much sustaining throttle raises the target slip angle during a slide:
 * power oversteer, the tail stepping out further under load. */
const SLIDE_THROTTLE_SLIP_BOOST_DEG = 4
/** A lift with no brake, mid-slide, eases the target down instead of holding
 * it, so the car drifts wide rather than staying pinned at full angle. */
const SLIDE_LIFT_TARGET_FRACTION = 0.55
/** S during a slide is a brake MODULATOR, not the full manual-braking rate:
 * about 1.5g, so a slide never turns into a stop the way 4.6g would. */
const SLIDE_BRAKE_G = 1.5
/** Countersteering during RECOVER (steering opposite the slip's own sign)
 * speeds the spring back to straight instead of just waiting it out. */
const COUNTERSTEER_RECOVER_BOOST = 2.2

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
  /** Slip angle, degrees. Signed: the sign is the direction the tail has
   * stepped out. Body yaw is tangent heading plus this, per the brief. */
  slipAngle: number
  /** Internal: rate of change of slipAngle, degrees/second. Carries momentum
   * from the build phase into the release spring so the recovery starts from
   * the slide's actual speed rather than from rest. */
  slipVel: number
  /** True during 'initiate' or 'slide', for scoring, audio and the
   * tyre-smoke/skid-mark visuals to gate on -- they don't need the
   * grip/initiate/slide/recover distinction, just "is something happening". */
  drifting: boolean
  /** GRIP -> INITIATE -> SLIDE -> RECOVER (Block G). */
  driftPhase: DriftPhase
  /** Cumulative drift score this session. Never resets on its own; the UI
   * layer owns comparing it against a best score in localStorage. */
  driftScore: number
  /** Forward distance covered since the last refuel, metres. Floored at 0 by
   * reversing, never by wrapping `s` at the start/finish line: this is what
   * `fuel` is actually derived from (Block F invariant 3), so backing over
   * the line cannot read as free fuel the way a raw `1 - s/length` would. */
  progress: number
  /** True while in reverse gear (Block F / F5). Dashboard reads this via
   * `gear === REVERSE_GEAR`, but the flag is kept separately since `gear`
   * alone can't distinguish "reverse" from "an invalid forward index". */
  reversing: boolean
  /** Seconds S has been held while stationary, counting toward engaging
   * reverse. Reset to 0 the instant that condition stops holding. */
  reverseHoldTime: number
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
  /** SPACE. Ignored below DRIFT_MIN_SPEED and whenever steerEnabled is false,
   * the same gate the rest of manual control already uses. */
  handbrake: boolean
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
    slipAngle: 0,
    slipVel: 0,
    drifting: false,
    driftPhase: 'grip',
    driftScore: 0,
    progress: s,
    reversing: false,
    reverseHoldTime: 0,
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

/** Modulo that stays in [0, length) for a negative `x` too. Plain `%` in JS
 * keeps the sign of its left operand, which silently broke every consumer
 * that assumed `s` never leaves [0, length) the moment reverse could make
 * `advance` negative. */
function wrapMod(x: number, length: number) {
  const m = x % length
  return m < 0 ? m + length : m
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

  // Reverse engagement (Block F / F5): holding S while essentially stopped,
  // with no throttle, engages reverse after REVERSE_ENGAGE_TIME. Only while
  // free driving -- there is never a stop target to reverse out of, and the
  // auto-brake already owns the car whenever one is set.
  if (!state.reversing && input.targetS === null) {
    if (state.v < REVERSE_ENGAGE_SPEED && input.brake && !input.throttle) {
      state.reverseHoldTime += step
      if (state.reverseHoldTime >= REVERSE_ENGAGE_TIME) {
        state.reversing = true
        state.reverseHoldTime = 0
        state.v = 0
      }
    } else {
      state.reverseHoldTime = 0
    }
  }

  let advance: number

  if (state.reversing) {
    // The pedal you already have your foot near is the one that moves you
    // the way you are facing: S is the reverse "gas", W brakes it, and once
    // W has fully stopped the reverse roll control hands back to forward
    // drive, so the very next W is a normal launch rather than a lurch.
    let rForce = -ROLL_DRAG
    if (input.throttle) {
      rForce = -MASS * BRAKE_DECEL
      state.braking = true
    } else if (input.brake) {
      rForce = MASS * REVERSE_ACCEL
      state.braking = false
    } else {
      state.braking = false
    }
    state.v = clamp(state.v + (rForce / MASS) * step, 0, REVERSE_TOP_SPEED)
    if (input.throttle && state.v < 0.1) {
      state.reversing = false
      state.v = 0
    }
    advance = -state.v * step
    // No gearbox in reverse: readouts below skip updateGearbox entirely
    // while this flag is set, so these three are the whole picture.
    state.gear = REVERSE_GEAR
    state.rpm = IDLE_RPM
    state.shiftCut = 0
  } else {
    const drag = DRAG_K * state.v * state.v + (state.v > 0.1 ? ROLL_DRAG : 0)
    let force = -drag

    // Automatic braking into a section stop. Braking begins v^2 / (2a)
    // before the marker, and the rate is recomputed from the distance
    // remaining every step, so the car lands on the marker rather than near it.
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
    } else {
      // Throttle and brake are ADDITIVE, not an either/or: W and S held
      // together is valid (left-foot braking), and a slide's own brake
      // modulator must never fully override the throttle sustaining it.
      // `driftPhase` here is still last frame's value (this frame's phase
      // update happens below, in the lateral section) -- a one-frame lag
      // that does not matter at simulation rates.
      let netForce = 0
      state.braking = false
      if (input.brake) {
        const brakeG = state.driftPhase === 'slide' ? SLIDE_BRAKE_G : BRAKE_G
        netForce -= MASS * brakeG * G
        state.braking = true
      }
      if (input.throttle && state.shiftCut <= 0) {
        const tractionFraction = state.driftPhase === 'slide' ? SLIDE_THROTTLE_TRACTION : 1
        netForce += tractionAt(state.v) * tractionFraction
      }
      force = netForce - drag
    }

    state.v += (force / MASS) * step
    if (state.v < 0) state.v = 0
    if (state.v > TOP_SPEED) state.v = TOP_SPEED

    advance = state.v * step
  }

  state.s = wrapMod(state.s + advance, track.length)
  state.travelled += advance
  // Fuel invariant 3's input: forward-only progress, floored at 0 so
  // reversing past the last refuel point cannot dip it negative and cannot,
  // by construction, ever raise fuel back up either (see below).
  state.progress = Math.max(0, state.progress + advance)

  if (!state.reversing && input.targetS !== null) {
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

  // Drifting: GRIP -> INITIATE -> SLIDE -> RECOVER (Block G). Slip angle is
  // its own accumulator, independent of d/vd, and only ever feeds a lateral
  // NUDGE into dNext -- which still passes through the kerb return and the
  // STEER_LIMIT clamp below like everything else, so a drift can push the
  // car around but never off the track.
  const slipBefore = state.slipAngle
  const turningHard = Math.abs(steer) >= NATURAL_STEER_THRESHOLD
  const cornering = Math.abs(curvature) > NATURAL_CURVATURE_THRESHOLD
  const aboveMinSpeed = state.v >= DRIFT_MIN_SPEED
  const liftingOrBraking = input.brake || !input.throttle
  // What INITIATEs a slide: SPACE anywhere, or a real weight-transfer
  // trigger (braking or lifting) while actually turning into a corner.
  // Never gated on `!input.handbrake` the way the first pass had it, since
  // that only decided which slip RANGE applies, not whether a slide starts.
  const canInitiate =
    input.steerEnabled &&
    aboveMinSpeed &&
    (input.handbrake || (liftingOrBraking && turningHard && cornering))
  // What SUSTAINS an established slide: throttle now KEEPS it going instead
  // of ending it, which is the actual bug fix here. A slide also survives
  // on the handbrake alone, or on continued brake-and-steer.
  const canSustain =
    input.steerEnabled &&
    aboveMinSpeed &&
    (input.handbrake || input.throttle || (input.brake && turningHard))

  switch (state.driftPhase) {
    case 'grip':
      if (canInitiate) state.driftPhase = 'initiate'
      break
    case 'initiate':
      if (!aboveMinSpeed || !canSustain) state.driftPhase = 'recover'
      else if (Math.abs(state.slipAngle) >= SLIDE_ENTER_DEG) state.driftPhase = 'slide'
      break
    case 'slide':
      if (!aboveMinSpeed || !canSustain) state.driftPhase = 'recover'
      break
    case 'recover':
      if (Math.abs(state.slipAngle) < SLIP_SETTLE_DEG) state.driftPhase = 'grip'
      else if (canInitiate) state.driftPhase = 'initiate'
      break
  }

  const building = state.driftPhase === 'initiate' || state.driftPhase === 'slide'
  if (building) {
    // Which way the tail steps out: the corner's own direction if there is
    // one, otherwise whichever way the driver is already steering, otherwise
    // whatever the car was already doing (so a drift started on a straight
    // does not have to pick a side from nothing).
    const driftDir =
      Math.abs(curvature) > 1e-6
        ? Math.sign(curvature)
        : steer !== 0
          ? Math.sign(steer)
          : state.slipAngle !== 0
            ? Math.sign(state.slipAngle)
            : 1
    // Steering INTO the slide (same sign as driftDir) tightens it toward the
    // max; countersteering loosens it back toward straight. This is the "A/D
    // modulates it" the brief asks for. The forced (SPACE) range is wider
    // than the natural one: a handbrake commits harder than trail-braking.
    const steerAlign = steer * driftDir
    const base = input.handbrake ? SLIP_BASE_DEG : NATURAL_SLIP_BASE_DEG
    const modulate = input.handbrake ? SLIP_MODULATE_DEG : NATURAL_SLIP_MODULATE_DEG
    const maxDeg = input.handbrake ? SLIP_MAX_DEG : NATURAL_SLIP_MAX_DEG
    let targetMag = clamp(base + steerAlign * modulate, 0, maxDeg)
    if (state.driftPhase === 'slide') {
      // Throttle raises the target (power oversteer, the tail stepping out
      // further under load); a lift with no brake eases it down instead of
      // holding it, so the car drifts wide rather than staying pinned.
      if (input.throttle) targetMag = Math.min(maxDeg, targetMag + SLIDE_THROTTLE_SLIP_BOOST_DEG)
      else if (!input.brake) targetMag *= SLIDE_LIFT_TARGET_FRACTION
    }
    const target = driftDir * targetMag
    const buildSmooth = 1 - Math.exp(-SLIP_BUILD_RATE * step)
    state.slipAngle += (target - state.slipAngle) * buildSmooth
  } else {
    // RECOVER or GRIP: a lightly underdamped spring back to zero, so the
    // nose swings very slightly past straight before settling rather than
    // snapping back. Countersteering (steering opposite the slip's own
    // sign) speeds the spring rather than fighting it.
    const counterSteering = state.driftPhase === 'recover' && steer !== 0 && Math.sign(steer) !== Math.sign(state.slipAngle || steer)
    const damping = SLIP_DAMPING * (counterSteering ? COUNTERSTEER_RECOVER_BOOST : 1)
    const accel = -SLIP_SPRING_K * state.slipAngle - damping * state.slipVel
    state.slipVel += accel * step
    state.slipAngle += state.slipVel * step
    if (Math.abs(state.slipAngle) < SLIP_SETTLE_DEG && Math.abs(state.slipVel) < SLIP_SETTLE_VEL) {
      state.slipAngle = 0
      state.slipVel = 0
    }
  }
  if (building) state.slipVel = (state.slipAngle - slipBefore) / step
  state.drifting = building

  if (state.drifting) {
    const slipRad = (state.slipAngle * Math.PI) / 180
    dNext += Math.sin(slipRad) * state.v * step * DRIFT_LATERAL_K
    state.v = Math.max(0, state.v - DRIFT_SCRUB_K * Math.abs(slipRad) * state.v * step)
    state.driftScore += Math.abs(state.slipAngle) * state.v * DRIFT_SCORE_K * step
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

  // No gearbox in reverse: state.gear/rpm/shiftCut were already set directly
  // above, and GEAR_TOP[REVERSE_GEAR] is not a real index.
  if (!state.reversing) updateGearbox(state, step)

  // Monotonic invariant (Block F): fuel is a function of forward PROGRESS
  // (see above), never of raw `s` directly -- `s` wraps at the start/finish
  // line, and reversing can walk it backward, either of which would read as
  // free fuel off a fresh `1 - s/length`. The only real refuel is the
  // explicit `fuel = 1` Car.tsx sets at CONTACT; everywhere else fuel can
  // fall but never rise, which the outer `Math.min` guarantees even if
  // `progress` itself is ever wrong.
  state.fuel = Math.min(state.fuel, clamp(1 - state.progress / track.length, 0, 1))
  // Wheels spin the way the car is actually travelling.
  state.wheelAngle += (state.reversing ? -state.v : state.v) / WHEEL_RADIUS * step

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
