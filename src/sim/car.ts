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
 *
 * --- Steering/drift model (Block H rewrite) ---
 *
 * The car's position is still authoritative in track-relative (s, d): arc
 * length and lateral offset, exactly as before, and every downstream system
 * (fuel, section stops, the minimap) still reads those two numbers and does
 * not know this file changed. What changed is what DRIVES them. The old
 * model let A/D nudge `d` directly and let track curvature itself push the
 * car around a corner (`dNext += sign(curvature) * drift * step`, fed by
 * nothing but the road shape) -- the car followed the track whether or not
 * anyone steered. This version is a small 2-DOF bicycle model: A/D sets a
 * target front-wheel angle, that angle plus the car's own velocity produces
 * front/rear tyre slip angles, slip angles produce lateral tyre forces
 * (capped by a friction circle shared with braking/acceleration), tyre
 * forces produce a yaw moment and a lateral acceleration, and only THOSE are
 * integrated into a heading and a velocity. `s` and `d` are then just that
 * velocity, resolved into the track's own basis. Nothing here reads track
 * curvature to move the car sideways; the track only ever supplies where it
 * is (`headingAt`) and how sharply it turns (`curvatureAt`, unused by the
 * physics itself now, kept on the interface for anything downstream that
 * still wants it).
 */

import { GRIP_G, G, REF_SPEED } from '../track/circuit'
import { RUMBLE_D, STEER_LIMIT, WHEEL_RADIUS } from './carSpec'

/** Top speed, about 305 km/h. */
export const TOP_SPEED = REF_SPEED

const DEG = Math.PI / 180

/**
 * Mass is a modelling choice, not a measurement. It only ever appears as a
 * divisor next to the force numbers below, which were tuned together to hit the
 * acceleration targets, so changing it alone changes nothing useful.
 *
 * Kept at the pre-overhaul value rather than adopted from a generic "sports
 * car" reference (1200kg is the more typical figure) because POWER,
 * LAUNCH_ACCEL and DRAG_K were all tuned together against 800kg to hit the
 * spec's 0-100/0-200 targets; changing mass alone without retuning those
 * would silently blow the acceleration figures for a reason that has nothing
 * to do with this rewrite. The cornering-stiffness values below are the
 * user-facing tuning knob for how the car FEELS at the limit; mass is not.
 */
const MASS = 800

/** Acceleration limit from tyre grip, at a standstill. */
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
 * has enough weight transfer to feed natural oversteer; 4g read as too
 * gentle for that to land. 4.6g is the new value. Under the bicycle model
 * this same number is what makes trail-braking loosen the rear for real
 * (see CG_HEIGHT below), not because anything here says so directly.
 */
export const BRAKE_G = 4.6
/** Automatic braking into a section stop, in g. */
export const STOP_BRAKE_G = 5

const BRAKE_DECEL = BRAKE_G * G
const STOP_DECEL = STOP_BRAKE_G * G

/**
 * Reference lateral grip, in m/s^2. No longer a hard cap the sim enforces
 * directly (see GRIP_G below) -- kept only as a normalising figure for the
 * roll-lean cosmetic and the advisory `cornerSpeed` helper the section-stop
 * lookahead AI uses to decide when to lift.
 */
const NOMINAL_GRIP = GRIP_G * G

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

// --- bicycle model (Block H) ---

/** Wheelbase, metres. CG_TO_FRONT + CG_TO_REAR must sum to this. */
const WHEELBASE = 2.6
/** CG to front axle, metres. Closer to the front than the rear: combined
 * with the rear's higher cornering stiffness below, the car is stable
 * (understeering) at the limit by default, and needs braking or the
 * handbrake to load it into oversteer, not a hair-trigger. */
const CG_TO_FRONT = 1.1
const CG_TO_REAR = 1.5
/** CG height, metres. Not measured (there is nothing to measure it from);
 * a plausible low sports-car figure, and the one number in this model with
 * no better source than "reasonable". Combined with BRAKE_G it is what
 * makes trail-braking loosen the rear -- see the weight-transfer comment
 * below for how directly that follows from this single value. */
const CG_HEIGHT = 0.5

/** Front/rear tyre cornering stiffness, N per radian of slip angle.
 * Rebalanced (Block I) from 80000/85000: the front was saturating into its
 * slip-angle plateau at a shallower angle than any reasonable steering input
 * could avoid, so any turn immediately maxed out front grip and read as
 * twitchy. Lowering the front raises how far it can be steered before it
 * saturates; raising the rear keeps the back end planted so the same change
 * doesn't turn every turn-in into oversteer. */
const FRONT_CORNERING_STIFFNESS = 32000
const REAR_CORNERING_STIFFNESS = 150000

/** Front wheel steering limit and how fast the actuator reaches a new target.
 * Both reduced (Block I) from 32deg/8 -- see the file-level note on why this
 * alone was NOT enough by itself (the front axle was saturating at ~14.6deg
 * of slip angle even before this change, so a smaller max angle alone barely
 * moved the numbers until FRONT_CORNERING_STIFFNESS also came down). */
const MAX_STEER_DEG = 18
const MAX_STEER_RAD = MAX_STEER_DEG * DEG
const STEER_RESPONSE = 4

/**
 * Yaw moment of inertia, kg*m^2. Not measured either: `MASS * a * b` is the
 * standard stand-in when the real figure (mass distribution integrated over
 * the whole body) is unavailable, equivalent to assuming a radius of
 * gyration of sqrt(a*b) -- a common simplification in lightweight vehicle
 * sims, not a real spec number. Doubled (Block I): the plain a*b figure let
 * yaw rate spin up too readily for how planted the retuned tyres above are
 * meant to feel -- a real car's mass is not concentrated at the axles the
 * way this stand-in implies, so the extra factor is a coarse correction in
 * the same spirit as the stand-in itself, not a new assumption.
 */
const YAW_INERTIA = MASS * CG_TO_FRONT * CG_TO_REAR * 2

/**
 * Additional yaw torque opposing rotation, rad/s^2 -- see YAW_DAMPING_LINEAR
 * and YAW_DAMPING_QUADRATIC just below for the two terms this splits into
 * and why. Added (Block I) only after verifying every sign, force
 * direction, axle load and coordinate transform in this file was already
 * correct: with those all confirmed right, a saturated linear tyre model
 * still has nowhere for a large yaw rate to go once both axles are pinned
 * at their friction-circle ceiling -- the tyre-force "spring" that
 * normally restores the car goes flat (a saturated force does not grow
 * with slip angle any more), while the -vLong*yawRate centripetal coupling
 * term keeps growing right along with yawRate itself. Nothing was left to
 * arrest that growth.
 *
 * This is the modest, physically-justified fix invited once (and only
 * once) that verification was done: real tyres dissipate energy scrubbing
 * sideways in a way this simplified 2-DOF, purely force-based model has no
 * other mechanism to capture, and a torque opposing rotation rate is the
 * standard, textbook way that dissipation gets represented in a model this
 * size. It is added directly into the yaw acceleration calculation, before
 * integration -- not a multiply on the resulting yawRate/vLat afterward,
 * and not conditioned on "is this a spin" -- so it cannot mask a sign
 * error or a missing force the way an after-the-fact `yawRate *= 0.9`
 * would.
 *
 * A single LINEAR term forced an impossible choice: strong enough to
 * survive realistic messy play (rapid, overlapping handbrake/steer/brake
 * inputs -- not the clean single-hold-then-release this was first tuned
 * against) meant it also flattened an ordinary single handbrake drift to a
 * barely-there few degrees. A real car's own yaw damping (aerodynamic,
 * plus the tyres' own nonlinear behaviour past their linear region) does
 * not scale linearly with rotation rate either -- it grows closer to the
 * SQUARE of it, the same reason aerodynamic drag scales with v^2 not v.
 * Splitting it the same way resolves the conflict instead of trading one
 * failure for the other: gentle at the yaw rates an ordinary drift
 * actually reaches (a few tenths to ~1.5 rad/s), sharply stronger only
 * once yaw rate is already in the range that a real car would call a spin
 * (rapid, compounding handbrake/steer/brake input measured up to ~7 rad/s
 * before this existed).
 */
const YAW_DAMPING_LINEAR = 1.5
const YAW_DAMPING_QUADRATIC = 2.2

/**
 * Hard ceiling on vLat's magnitude, m/s. `state.v` (longitudinal speed) has
 * always been clamped to [0, TOP_SPEED] -- nothing physical stops it from
 * being unbounded either, the clamp is just there because an unbounded
 * integrator has no business representing a real car's speed. vLat was the
 * one velocity state with no equivalent limit, and once the friction
 * circle saturates, its own tyre-force "brake" is a CONSTANT (a saturated
 * force does not grow with slip angle), so recovering from an extreme vLat
 * takes time roughly proportional to how extreme it got -- the yaw damping
 * above controls ROTATION, but does nothing to stop vLat itself from
 * reaching an unphysical peak in the first place under compounding,
 * unrealistic input (rapid overlapping handbrake/steer/brake presses, not
 * a single clean hold). 40 m/s is generous for how large a genuine drift's
 * lateral speed gets (a clean 20-degree slide around 30 m/s forward implies
 * roughly 11 m/s of vLat) while still well short of anything that reads as
 * broken.
 */
const VLAT_MAX = 40

/**
 * Self-alignment torque while pinned against the track boundary, rad/s^2
 * per rad of heading misalignment from the track tangent. `d` (position)
 * being clamped at the kerb only ever stopped the car moving further out;
 * it never touched the car's HEADING, so a slide that reached the kerb
 * with a lot of yaw still on it could settle at genuinely zero slip angle
 * -- fully "recovered" by every tyre measure -- while still pointed
 * anywhere up to nearly sideways into the barrier, and then just cruise
 * there indefinitely, no longer sliding but clearly not driving normally
 * either. A real wall constrains lateral motion along its whole length,
 * not just at one point, which is why a car (or a coin) sliding along a
 * guardrail rotates to run ALONG it rather than staying stuck at whatever
 * angle it first touched it at -- this is that effect, gated on having
 * actually been pinned last step (a real thing to be touching, not a
 * background effect) and scaled by how far off the heading already is, so
 * a line legitimately held tight against the kerb while pointed the right
 * way (near-zero misalignment already) is unaffected.
 */
const KERB_ALIGN_K = 1.5

/**
 * Below this road speed, steering blends from the dynamic (slip-angle) tyre
 * model toward a no-slip kinematic turn instead. A stationary tyre cannot
 * build a meaningful slip angle -- the atan2 in alphaFront/alphaRear stays
 * well-defined (see the 0.1 floor below) but the FORCE it would imply at
 * v=0 is not physical, so cornering stiffness itself is scaled down to
 * nothing at rest and a pure Ackermann yaw rate (vLong * tan(steer) /
 * WHEELBASE, no slip, no forces) takes over instead. This is what stops a
 * standing start from being able to slide sideways, and it is also what
 * lets reverse steer at all despite skipping the dynamic model entirely.
 * Lowered from 20 (Block I): a full-authority dynamic model kicking in only
 * above 20 m/s meant ordinary low/mid-speed driving and tapping the wheel
 * out of a turn were still going through the kinematic blend, which is what
 * made a light steering input feel like it snapped the car sideways instead
 * of tracking smoothly.
 */
const STEER_GRIP_SPEED = 14

/**
 * How much the handbrake multiplies rear cornering stiffness AND the
 * rear's peak grip budget by. A locked/skidding wheel has both a much
 * flatter slip-angle response and a lower peak friction than a rolling one,
 * so both are scaled, not just one.
 *
 * Raised (Block I) from 0.25 to 0.5. At 0.25 -- combined with any of the
 * grip values this project has used -- sustained handbrake + full steer at
 * speed crosses the model's own stability boundary (the classic
 * bicycle-model divergence condition once one axle's usable stiffness
 * drops far enough below the other's) and the car does not settle into a
 * slide, it genuinely spins: yaw rate climbs without bound instead of
 * reaching a steady drift angle. Swept empirically in 0.02 steps against a
 * 1.5s full-lock handbrake hold at 30 m/s: below ~0.46 the spin was
 * unbounded, above ~0.55 the slide became barely noticeable. 0.5 sits in
 * the middle of that -- a real, sustained, controllable slide (tens of
 * degrees of slip) without ever crossing into an unrecoverable spin.
 */
const HANDBRAKE_REAR_GRIP = 0.3

/** Floor on either axle's load, as a fraction of its own static value.
 * BRAKE_G is aggressive enough (4.6g) that the raw weight-transfer term can
 * exceed the rear's entire static load under hard braking; a real
 * suspension runs out of travel long before that, so this stands in for
 * that limit rather than letting the load (and the grip budget derived
 * from it) go to zero or negative. */
const MIN_LOAD_FRACTION = 0.2

const STATIC_FRONT_LOAD = MASS * G * (CG_TO_REAR / WHEELBASE)
const STATIC_REAR_LOAD = MASS * G * (CG_TO_FRONT / WHEELBASE)

/**
 * How fast the car eases back off the kerb when nobody is steering, in m/s.
 *
 * Lateral speed decays but lateral POSITION does not recentre, which is the
 * right call for a line the reader chose. It is the wrong call for a line
 * understeer chose: without this, one moment of running wide parks the car on
 * the kerb for the rest of the lap and the rumble never stops.
 *
 * It only pulls while a wheel is actually over the kerb, so any line on the
 * asphalt is still held exactly. Unrelated to tyre physics -- this is a
 * track-boundary/assist feature, same role as STEER_LIMIT below, not part
 * of what makes the car drift or grip.
 */
const KERB_RETURN = 1.5
/** How far inside the kerb the return settles, so the pull does not stop
 * exactly on the trigger threshold and run forever right at the edge. */
const KERB_CLEARANCE = 0.6

// --- drift classification (scoring/audio/visuals only, not physics) ---

/** Below this speed a slide does not read as "drifting" for the score/audio/
 * tyre-smoke gates -- a real slide at walking pace does not read as one
 * either. Plays no part in whether the tyres actually lose grip. */
const DRIFT_MIN_SPEED = 60 / 3.6
/** Degrees of (derived) slip angle above which the classification flips on. */
const DRIFT_CLASSIFY_DEG = 6
/** Clamp applied to the DERIVED slip angle before it reaches the UI, audio
 * squeal curve or score formula -- a wild spin can transiently imply a slip
 * angle far past what those consumers expect (the squeal curve especially),
 * so this bounds the reported number. The underlying vLat/yaw physics are
 * never clamped by this; only what gets reported is. */
const SLIP_MAX_DEG = 20
/** Score per (degree of slip * m/s of speed * second). Arbitrary, tuned only
 * so the popup shows a few hundred points for a good corner, not four digits. */
const DRIFT_SCORE_K = 1

/** Smoothing for the pitch and roll readouts, per second. */
const LEAN_SMOOTH = 9
/** Longitudinal acceleration that reads as full pitch. */
const PITCH_REF = STOP_DECEL
/** Lateral acceleration that reads as full roll. */
const ROLL_REF = NOMINAL_GRIP

/**
 * Guard for every divisor taken from frame time.
 *
 * Two frames inside the same millisecond give dt 0, and 0/0 is NaN. Because
 * pitch and roll are smoothed accumulators, one such frame froze the car roll
 * and both front wheels for the rest of the session during the v1 build.
 */
const MIN_DT = 1e-4

/**
 * Ceiling on the wheel spin rate actually fed to the render, rad/s. Purely
 * cosmetic -- see its one call site in stepCar. 30 rad/s corresponds to a
 * linear speed of 30*WHEEL_RADIUS =~ 11.8 m/s (=~42 km/h): below that the
 * wheel's true rate is used unchanged (measured smooth at 26.6 km/h, ~8.5
 * degrees of rotation per 60fps frame); above it, the visual rate stays
 * flat rather than climbing toward the true ~184 rad/s TOP_SPEED would
 * otherwise demand, which is what was reading as a wobble rather than a
 * fast spin.
 */
const WHEEL_VISUAL_OMEGA_MAX = 30

export interface CarState {
  /** Arc length along the lap, metres. */
  s: number
  /** Lateral offset from the racing line. Positive is the driver left. */
  d: number
  /** Longitudinal speed, vehicle frame, m/s. Always >= 0; direction (forward
   * vs reverse) is tracked separately by `reversing`. */
  v: number
  /** Lateral speed, vehicle frame, m/s. Positive is the driver left, same
   * sign convention as `d`. Zero unless the tyres are actually generating a
   * net sideways force. */
  vLat: number
  /** Vehicle heading, world radians, same atan2(tx, tz) convention as the
   * track tangent. The one and only source of which way the car body
   * points -- nothing else in this file or the renderer computes a second,
   * competing heading. */
  yaw: number
  /** Yaw angular velocity, rad/s. */
  yawRate: number
  /** Actual front-wheel steering angle, radians, signed the same way as
   * CarInput.steer (positive is toward the driver left). Smoothly chases
   * the A/D target rather than snapping to it. */
  steeringAngle: number
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
  /** Signed lateral acceleration, m/s^2, in the vehicle frame (positive is
   * the driver left), including the yaw-rate coupling term -- this is the
   * real number a driver would feel, not a cosmetic estimate. */
  accelLat: number
  /** Smoothed -1..1 pitch target. Positive is nose down. */
  pitch: number
  /** Smoothed -1..1 roll target. */
  roll: number
  /** True while any brake is applied, for the brake lights. */
  braking: boolean
  /** True while the front axle is being asked for more lateral force than
   * its grip budget can supply this frame -- the tyres are saturated and
   * the car is running wide regardless of input. */
  understeer: boolean
  /** Total distance travelled, metres. Laps are not counted anywhere in the UI. */
  travelled: number
  /** Slip angle, degrees, signed. DERIVED every step from the actual
   * vLat/v, per atan2(vLat, max(|v|, 0.1)) -- never an independently
   * animated value. Clamped to +/-SLIP_MAX_DEG for its UI/audio/score
   * consumers only. */
  slipAngle: number
  /** True while |slipAngle| clears DRIFT_CLASSIFY_DEG above DRIFT_MIN_SPEED
   * -- a classification for scoring, audio and the tyre-smoke/skid-mark
   * visuals to gate on, not something any physics reads back. */
  drifting: boolean
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
  /** -1 to 1. Positive steers toward the driver left. Sets a TARGET
   * front-wheel angle (see CarState.steeringAngle) -- never applied to the
   * body directly. */
  steer: number
  /**
   * Arc length of the stop the car is braking for, or null while free driving.
   * When set, the car brakes itself to rest on the marker.
   */
  targetS: number | null
  /** False during the lights, a warp, or while stopped: A and D are ignored. */
  steerEnabled: boolean
  /** SPACE. Reduces rear tyre grip (see HANDBRAKE_REAR_GRIP) rather than
   * forcing any particular slip angle -- whether that actually produces a
   * slide depends on speed and how hard the front is turned in, same as a
   * real handbrake. */
  handbrake: boolean
}

export interface TrackQuery {
  length: number
  /** Signed curvature at an arc length, 1/metres. Not read by the physics
   * itself any more (heading alone is enough to resolve velocity into s/d);
   * kept on the interface for advisory helpers like `cornerSpeed`. */
  curvatureAt(s: number): number
  /** Track tangent heading at an arc length, radians, atan2(tx, tz)
   * convention. What the bicycle model's yaw is measured against. */
  headingAt(s: number): number
}

export function createCarState(s = 0): CarState {
  return {
    s,
    d: 0,
    v: 0,
    vLat: 0,
    // NaN is a sentinel: stepCar snaps this to the track heading on its
    // first call, the same way the old visualHeading used to snap on its
    // first frame. Anything before that first call has no meaningful
    // heading to report.
    yaw: Number.NaN,
    yawRate: 0,
    steeringAngle: 0,
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
    drifting: false,
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

/** Wraps an angle into (-PI, PI]. */
function normalizeAngle(a: number): number {
  let x = a % (Math.PI * 2)
  if (x > Math.PI) x -= Math.PI * 2
  if (x < -Math.PI) x += Math.PI * 2
  return x
}

/**
 * Scales (fx, fy) down to the boundary of a circle of radius maxForce if it
 * falls outside it, preserving direction. The combined-slip constraint every
 * axle is subject to: cornering eats into how much braking/acceleration
 * force is left, and vice versa, exactly like a real tyre's friction circle.
 */
function clampToCircle(fx: number, fy: number, maxForce: number): [number, number] {
  const mag = Math.hypot(fx, fy)
  if (mag <= maxForce || mag < 1e-9) return [fx, fy]
  const scale = maxForce / mag
  return [fx * scale, fy * scale]
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

  if (Number.isNaN(state.yaw)) state.yaw = track.headingAt(state.s)

  // Steering actuator: A/D set a TARGET front-wheel angle; this is the only
  // place `steeringAngle` moves, and it always chases the target rather than
  // snapping to it. Nothing below this line ever rotates the body directly.
  const steerInput = input.steerEnabled ? clamp(input.steer, -1, 1) : 0
  const targetSteer = steerInput * MAX_STEER_RAD
  state.steeringAngle += (targetSteer - state.steeringAngle) * (1 - Math.exp(-STEER_RESPONSE * step))

  // Weight transfer, lagged one step behind accelLong (last frame's value,
  // still sitting in state.accelLong from the tail end of the previous
  // call). Solving this simultaneously with this frame's own forces would
  // need a much heavier iterative or closed-form solution for a one-frame
  // difference a real suspension's own settling time would swallow anyway.
  //
  // transfer > 0 under braking (accelLong < 0): front load rises, rear
  // falls -- the sign is chosen for that outcome directly, not copied from
  // a textbook convention.
  const transfer = (-MASS * state.accelLong * CG_HEIGHT) / WHEELBASE
  const frontLoad = Math.max(STATIC_FRONT_LOAD * MIN_LOAD_FRACTION, STATIC_FRONT_LOAD + transfer)
  const rearLoad = Math.max(STATIC_REAR_LOAD * MIN_LOAD_FRACTION, STATIC_REAR_LOAD - transfer)

  // --- reverse engagement (unchanged: purely longitudinal, no tyre model
  // involved in the decision) ---
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
    // Reverse is a 25 km/h creep, not a scenario worth a tyre-slip model.
    // Steering here is plain kinematic (Ackermann) geometry -- no slip
    // angle, no lateral force -- which is both the physically correct model
    // at this speed and the simplest one, and it is what lets reverse
    // steer at all without pulling in the dynamic model above.
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
    state.gear = REVERSE_GEAR
    state.rpm = IDLE_RPM
    state.shiftCut = 0

    // Velocity points backward while reversing, which flips which way a
    // given wheel angle turns the car relative to forward driving -- same
    // as backing a real car out of a spot. The kinematic formula is
    // yawRate = vxSigned * tan(steer) / WHEELBASE; vxSigned is NEGATIVE
    // here (the vehicle is moving opposite its own forward axis), which is
    // what actually produces the flip -- BUG (now fixed): this used to read
    // `state.v` (the unsigned reverse speed) directly, which fed in the
    // same sign as forward driving and so never flipped anything. The
    // front tyres still point exactly where the actuator puts them (this
    // line never touches steeringAngle) -- only the resulting rotation
    // direction changes, which is the correct behaviour, not a visual
    // steering flip.
    state.yawRate = (-state.v * Math.tan(state.steeringAngle)) / WHEELBASE
    state.yaw = normalizeAngle(state.yaw + state.yawRate * step)
    state.vLat = 0

    const trackHeading = track.headingAt(state.s)
    const theta = normalizeAngle(state.yaw - trackHeading)
    const vLongSigned = -state.v
    const vS = vLongSigned * Math.cos(theta) - state.vLat * Math.sin(theta)
    const vD = vLongSigned * Math.sin(theta) + state.vLat * Math.cos(theta)
    advance = vS * step
    state.s = wrapMod(state.s + advance, track.length)
    state.d = clamp(state.d + vD * step, -STEER_LIMIT, STEER_LIMIT)
    state.accelLat = 0
    state.understeer = false
  } else {
    // --- forward driving: the 2-DOF bicycle model ---
    const trackHeading = track.headingAt(state.s)

    // See STEER_GRIP_SPEED's own comment: this both scales down the dynamic
    // tyre forces near a standstill and blends the resulting yaw rate
    // toward a no-slip kinematic turn, so a standing start cannot slide.
    const authority = clamp(state.v / STEER_GRIP_SPEED, 0, 1)

    const yawRateOld = state.yawRate
    const vLatOld = state.vLat
    const vLongOld = state.v
    const vLongSafe = Math.max(vLongOld, 0.1)

    const alphaFront = Math.atan2(vLatOld + CG_TO_FRONT * yawRateOld, vLongSafe) - state.steeringAngle
    const alphaRear = Math.atan2(vLatOld - CG_TO_REAR * yawRateOld, vLongSafe)

    const rearGripMult = input.handbrake ? HANDBRAKE_REAR_GRIP : 1
    const Cf = FRONT_CORNERING_STIFFNESS * authority
    const Cr = REAR_CORNERING_STIFFNESS * authority * rearGripMult

    const FyFrontRaw = -Cf * alphaFront
    const FyRearRaw = -Cr * alphaRear

    // frontLoad/rearLoad are already forces in Newtons (STATIC_FRONT_LOAD
    // etc. already bake in G), so the tyre-force budget is load * GRIP_G --
    // GRIP_G is the (dimensionless) friction coefficient, not an
    // acceleration; multiplying by G again here would double-count gravity
    // and inflate the grip budget roughly tenfold.
    const maxForceFront = frontLoad * GRIP_G
    const maxForceRear = rearLoad * rearGripMult * GRIP_G

    // Longitudinal demand. Automatic braking into a section-stop marker
    // overrides throttle/brake entirely, same as before (an assistive,
    // scripted deceleration, not part of the tyre model); otherwise the two
    // pedals are additive, so left-foot braking is valid input.
    let autoBrake = 0
    if (input.targetS !== null) {
      const remaining = forwardGap(state.s, input.targetS, track.length)
      const needed = (vLongOld * vLongOld) / (2 * STOP_DECEL)
      if (remaining <= needed || remaining < 1) {
        autoBrake = remaining > 0.01 ? (vLongOld * vLongOld) / (2 * remaining) : STOP_DECEL
        autoBrake = Math.min(autoBrake, STOP_DECEL * 4)
      }
    }

    let brakeForce = 0
    let engineForce = 0
    if (autoBrake > 0) {
      brakeForce = MASS * autoBrake
      state.braking = true
    } else {
      state.braking = false
      if (input.brake) {
        brakeForce = MASS * BRAKE_G * G
        state.braking = true
      }
      if (input.throttle && state.shiftCut <= 0) {
        engineForce = tractionAt(vLongOld)
      }
    }
    // Brake bias follows the current weight distribution, same as a real
    // proportioning valve: the more heavily loaded axle does more of the
    // stopping. The engine only ever drives the rear axle.
    const totalLoad = frontLoad + rearLoad
    const FxFrontRaw = -brakeForce * (frontLoad / totalLoad)
    const FxRearRaw = engineForce - brakeForce * (rearLoad / totalLoad)

    const [FxFront, FyFront] = clampToCircle(FxFrontRaw, FyFrontRaw, maxForceFront)
    const [FxRear, FyRear] = clampToCircle(FxRearRaw, FyRearRaw, maxForceRear)

    // Understeer: the front axle was asked for more force (braking and/or
    // cornering combined) than its grip budget could supply this frame, so
    // clampToCircle actually cut it down. Not a curvature check -- a direct
    // read of whether the tyres saturated.
    state.understeer = Math.hypot(FxFrontRaw, FyFrontRaw) > maxForceFront + 1e-6

    const drag = DRAG_K * vLongOld * vLongOld + (vLongOld > 0.1 ? ROLL_DRAG : 0)
    const aLong = (FxFront + FxRear - drag) / MASS
    const newVLong = clamp(vLongOld + aLong * step, 0, TOP_SPEED)

    const cosSteer = Math.cos(state.steeringAngle)
    const yawMoment = CG_TO_FRONT * FyFront * cosSteer - CG_TO_REAR * FyRear
    // See KERB_ALIGN_K's own comment: `state.d`/`state.yaw` here are still
    // last step's values (this step hasn't touched either yet), which is
    // exactly the "was actually touching the boundary" and "how far off is
    // the heading" this needs.
    const wasPinned = Math.abs(state.d) >= STEER_LIMIT - 1e-3
    const thetaOld = normalizeAngle(state.yaw - trackHeading)
    const yawAccel =
      yawMoment / YAW_INERTIA -
      YAW_DAMPING_LINEAR * yawRateOld -
      YAW_DAMPING_QUADRATIC * yawRateOld * Math.abs(yawRateOld) -
      (wasPinned ? KERB_ALIGN_K * thetaOld : 0)
    // The -vLongOld*yawRateOld term is the standard bicycle-model coupling
    // from working in a ROTATING (vehicle) frame: without it a car turning
    // at constant slip angle would show zero lateral acceleration, which is
    // wrong -- it is still accelerating centripetally even at a steady slide.
    const latAccelVehicle = (FyFront * cosSteer + FyRear) / MASS - vLongOld * yawRateOld

    const yawRateKinematic = (vLongOld * Math.tan(state.steeringAngle)) / WHEELBASE
    let newYawRate = yawRateOld + yawAccel * step
    newYawRate = newYawRate * authority + yawRateKinematic * (1 - authority)
    const newVLat = clamp(vLatOld + latAccelVehicle * step, -VLAT_MAX, VLAT_MAX)
    const newYaw = normalizeAngle(state.yaw + newYawRate * step)

    // Resolve the vehicle-frame velocity into the track's own basis. This is
    // the ONLY place s/d are driven by velocity rather than by an artificial
    // per-frame nudge, and it is symmetric: a car pointed off the track
    // tangent (understeer running wide, a slide, anything) naturally moves
    // away from the racing line here, with no separate "push it wide" term
    // anywhere in this file.
    const theta = normalizeAngle(newYaw - trackHeading)
    const vS = newVLong * Math.cos(theta) - newVLat * Math.sin(theta)
    const vD = newVLong * Math.sin(theta) + newVLat * Math.cos(theta)

    let dNext = state.d + vD * step
    // Nudges the car back off the kerb only while nobody is actively
    // steering, so a deliberate line near the edge is never fought. A
    // track-boundary assist, not tyre physics.
    const kerbTarget = RUMBLE_D - KERB_CLEARANCE
    if (steerInput === 0 && Math.abs(dNext) > kerbTarget) {
      const pull = Math.min(KERB_RETURN * step, Math.abs(dNext) - kerbTarget)
      dNext -= Math.sign(dNext) * pull
    }
    const clampedD = clamp(dNext, -STEER_LIMIT, STEER_LIMIT)

    advance = vS * step
    state.v = newVLong
    // BUGFIX (Block I): this used to zero vLat on every frame the car was
    // pinned against STEER_LIMIT, not just the transition frame. That
    // severs the vLat<->alphaRear feedback the (vLat, yawRate) pair needs
    // to find its own equilibrium -- instead of settling into a tight line
    // against the kerb, yawRate climbed unopposed for as long as the car
    // stayed pinned, then dumped all of it into a violent slide the instant
    // it came off. The position clamp above is still what stops the car
    // leaving the road; vLat is left alone to keep doing its own job.
    state.vLat = newVLat
    state.yawRate = newYawRate
    state.yaw = newYaw
    state.d = clampedD
    state.s = wrapMod(state.s + advance, track.length)
    state.accelLat = latAccelVehicle
  }

  state.travelled += advance
  // Fuel invariant 3's input: forward-only progress, floored at 0 so
  // reversing (or spinning enough that vS goes briefly negative) cannot dip
  // it below 0 and cannot, by construction, ever raise fuel back up either.
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

  // No gearbox in reverse: state.gear/rpm/shiftCut were already set directly
  // above, and GEAR_TOP[REVERSE_GEAR] is not a real index.
  if (!state.reversing) updateGearbox(state, step)

  state.fuel = Math.min(state.fuel, clamp(1 - state.progress / track.length, 0, 1))
  // Wheels spin the way the car is actually travelling, capped to
  // WHEEL_VISUAL_OMEGA_MAX. `wheelAngle` has exactly one reader anywhere in
  // the project (Car.tsx's spin quaternion) -- nothing physical or
  // gameplay-facing depends on its true, uncapped value -- so this is a
  // rendering fix, not a physics one. True angular speed at TOP_SPEED is
  // v/WHEEL_RADIUS =~ 184 rad/s (=~1750 RPM, genuinely close to a real F1
  // wheel's own top-speed spin rate). Rotating a rigid mesh through that
  // much angle in a single 1/60s frame, with no motion-blur pass to hide
  // the gaps, does not read as "spinning very fast" -- it reads as
  // incoherent wobble, the wagon-wheel effect: consecutive discrete
  // snapshots that many degrees apart give the eye nothing to track a
  // single rotation direction from. Below the cap (roughly 40 km/h, per
  // WHEEL_VISUAL_OMEGA_MAX's own comment) this never engages at all.
  const trueOmega = (state.reversing ? -state.v : state.v) / WHEEL_RADIUS
  const cappedOmega = clamp(trueOmega, -WHEEL_VISUAL_OMEGA_MAX, WHEEL_VISUAL_OMEGA_MAX)
  state.wheelAngle += cappedOmega * step

  state.accelLong = (state.v - vBefore) / step

  // Slip angle is DERIVED here, after v/vLat have already settled for this
  // frame -- never an independently animated variable. This is the true
  // angle between where the car points and where it is actually going.
  const slipRad = Math.atan2(state.vLat, Math.max(Math.abs(state.v), 0.1))
  state.slipAngle = clamp(slipRad / DEG, -SLIP_MAX_DEG, SLIP_MAX_DEG)
  state.drifting = Math.abs(state.slipAngle) > DRIFT_CLASSIFY_DEG && state.v > DRIFT_MIN_SPEED
  if (state.drifting) {
    state.driftScore += Math.abs(state.slipAngle) * state.v * DRIFT_SCORE_K * step
  }

  const smooth = 1 - Math.exp(-LEAN_SMOOTH * step)
  const pitchTarget = clamp(-state.accelLong / PITCH_REF, -1, 1)
  const rollTarget = clamp(state.accelLat / ROLL_REF, -1, 1)
  state.pitch += (pitchTarget - state.pitch) * smooth
  state.roll += (rollTarget - state.roll) * smooth

  return { arrived }
}

/** Fastest speed a corner of this curvature can be taken without drifting wide.
 * Advisory only (used by the section-stop lookahead to decide when to lift) --
 * the physics itself no longer enforces this as a hard cap. */
export function cornerSpeed(curvature: number): number {
  const k = Math.abs(curvature)
  return k < 1e-9 ? TOP_SPEED : Math.min(TOP_SPEED, Math.sqrt(NOMINAL_GRIP / k))
}

/** Distance needed to brake to rest from a speed, at the section-stop rate. */
export function stopDistance(v: number): number {
  return (v * v) / (2 * STOP_DECEL)
}
