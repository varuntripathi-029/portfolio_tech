/**
 * Physical dimensions of the car, in one place.
 *
 * These are derived from the GLB node translations recorded in the spec, not
 * guessed, and everything that needs a car dimension reads it from here. The v1
 * build hardcoded a steer limit in the physics and a kerb threshold in the
 * camera, and the two drifted out of agreement with the band table inside one
 * stage.
 *
 * Pure: no three, no React. The sim script imports this in Node.
 */

import { KERB_INNER, RUNOFF_OUTER } from '../scene/trackLayout'

/** Group scale that brings the model to roughly metric. */
export const CAR_SCALE = 0.7

/** Wheel centre height in model space, which is also the rolling radius. */
const WHEEL_RADIUS_MODEL = 0.56
/** Front wheel node X in model space. Measured from the GLB. */
const FRONT_WHEEL_X_MODEL = 1.627
/** Rear wheel node Z in model space (spec 1.3's `tires003`, the merged rear
 * pair). Used by Block F's drift effects to place smoke and skid marks at
 * the rear axle; no separate rear track width is recorded anywhere, so
 * WHEEL_HALF_TRACK stands in for both axles, close enough for a cosmetic
 * particle/ribbon origin. */
const REAR_WHEEL_Z_MODEL = -3.69

/** World-space rolling radius, for converting speed to wheel spin. */
export const WHEEL_RADIUS = WHEEL_RADIUS_MODEL * CAR_SCALE

/** Distance from the car centreline to the outside of a front wheel. */
export const WHEEL_HALF_TRACK = FRONT_WHEEL_X_MODEL * CAR_SCALE

/** Rear axle position along the car's own local Z, world-scale metres.
 * Negative: behind the car's local origin, per the GLB's own convention. */
export const REAR_WHEEL_Z = REAR_WHEEL_Z_MODEL * CAR_SCALE

/**
 * How far the car may move off the racing line before the position clamp in
 * car.ts stops it. This is a hard boundary, not tyre grip, so it is felt as
 * an abrupt wall the instant a wheel reaches it -- most noticeable mid-drift,
 * where lateral speed is highest and the wall gets hit hardest.
 *
 * Originally KERB_OUTER - WHEEL_HALF_TRACK (~5.86m): the car was stopped at
 * the outside edge of the kerb, before the wheel ever reached the runoff.
 * That gave a drift no room to run wide through a corner before the wall.
 * Moved out to the edge of the paved runoff instead (~8.86m): the wheel
 * still never leaves pavement (kerb and runoff are both driveable surfaces
 * visually), but the car now has ~3m more room before the clamp, which is
 * roughly the difference between "the drift hits a wall immediately" and
 * "the drift has space to develop." The wall still exists at RUNOFF_OUTER --
 * this widens the room before it, it does not remove it.
 */
export const STEER_LIMIT = RUNOFF_OUTER - WHEEL_HALF_TRACK

/**
 * Lateral offset at which the OUTER WHEEL first touches the kerb, which is what
 * the rumble triggers on.
 *
 * The v1 build tested the car centreline against the kerb inner edge instead.
 * By the time the centreline reached 6m the outer wheel had been on the kerb
 * for about 1.1m of travel, so the rumble started late and the reachable band
 * was under a metre wide. Testing the wheel gives roughly 1.9m of usable band.
 */
export const RUMBLE_D = KERB_INNER - WHEEL_HALF_TRACK
