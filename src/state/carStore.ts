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
  warpProgress: -1,
  set: (next) => set(next),
  setWarpProgress: (warpProgress) => set({ warpProgress }),
}))
