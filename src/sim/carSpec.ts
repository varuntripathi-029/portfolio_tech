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

import { KERB_INNER, KERB_OUTER } from '../scene/trackLayout'

/** Group scale that brings the model to roughly metric. */
export const CAR_SCALE = 0.7

/** Wheel centre height in model space, which is also the rolling radius. */
const WHEEL_RADIUS_MODEL = 0.56
/** Front wheel node X in model space. Measured from the GLB. */
const FRONT_WHEEL_X_MODEL = 1.627

/** World-space rolling radius, for converting speed to wheel spin. */
export const WHEEL_RADIUS = WHEEL_RADIUS_MODEL * CAR_SCALE

/** Distance from the car centreline to the outside of a front wheel. */
export const WHEEL_HALF_TRACK = FRONT_WHEEL_X_MODEL * CAR_SCALE

/**
 * How far the car may move off the racing line before a wheel hangs over the
 * outside edge of the kerb. About 5.86m, derived rather than pasted.
 */
export const STEER_LIMIT = KERB_OUTER - WHEEL_HALF_TRACK

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
