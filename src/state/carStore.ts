import { create } from 'zustand'

/**
 * The car state the rest of the app reads.
 *
 * Mirrored out of the sim every frame by Car.tsx. Read it with `getState()` in
 * per-frame code and never subscribe there: a React re-render at 60fps for a
 * speed readout is the easiest way to lose the frame budget in a project like
 * this. The HUD subscribes imperatively and writes to refs instead.
 */
interface CarState {
  /** Arc length along the lap, metres. */
  s: number
  /** Lateral offset from the racing line. Positive is the driver left. */
  d: number
  /** Forward speed, m/s. */
  v: number
  gear: number
  rpm: number
  /** 1 at the line, 0 at the CONTACT marker. */
  fuel: number
  /** True while a brake is applied, for the brake lights. */
  braking: boolean
  /** Slip angle, degrees, signed. Body yaw is tangent heading plus this. */
  slipAngle: number
  /** True once a slide has built past a small deadzone: gates tyre smoke,
   * skid marks, the squeal, and the drift-score popup. */
  drifting: boolean
  /** Cumulative drift score for the current session, never reset by the sim
   * itself; the UI compares it against a localStorage best. */
  driftScore: number
  /** Milliseconds since lights-out this lap. Paused while a card is open or
   * a warp is in flight (Block F, spec reversal: a lap TIMER, not a lap
   * counter -- the counter stays banned). Reset to 0 at the next lights-out. */
  lapElapsedMs: number
  /** True while in reverse gear (Block F / F5). Dashboard reads this to show
   * "R"; AudioEngine reads it to drive the reverse whine. */
  reversing: boolean
  /** Raw throttle key state (Block G), not a sim output: AudioEngine needs to
   * know the actual pedal input for the load filter and the overrun burble,
   * which the resulting rpm/speed alone do not distinguish (coasting at a
   * held speed and just lifted look identical in rpm for a moment). */
  throttleInput: boolean
  /**
   * 0 to 1 while a navbar warp is running, -1 otherwise.
   *
   * Kept here rather than in raceStore because it changes every frame and
   * nothing should re-render on it.
   */
  warpProgress: number
  set: (next: Partial<CarState>) => void
  setWarpProgress: (warpProgress: number) => void
}

export const useCarStore = create<CarState>((set) => ({
  s: 0,
  d: 0,
  v: 0,
  gear: 0,
  rpm: 0,
  fuel: 1,
  braking: false,
  slipAngle: 0,
  drifting: false,
  driftScore: 0,
  lapElapsedMs: 0,
  reversing: false,
  throttleInput: false,
  warpProgress: -1,
  set: (next) => set(next),
  setWarpProgress: (warpProgress) => set({ warpProgress }),
}))
