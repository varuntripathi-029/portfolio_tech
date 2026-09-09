import { create } from 'zustand'

/**
 * Car position and speed, read every frame by the camera, lighting, and
 * wheel rotation. Plain getState() reads in useFrame, not the store hook,
 * so none of those subscribers re-render on every physics tick.
 */
interface CarState {
  z: number
  x: number
  speed: number
  /**
   * 0 to 1 while a navbar jump is running, -1 otherwise. The camera reads it
   * to snap instead of lerp and to punch the FOV, and the DOM speed-line
   * overlay reads it for opacity. Kept here rather than in raceStore because
   * it changes every frame and nothing should re-render on it.
   */
  jumpProgress: number
  set: (z: number, speed: number, x: number) => void
  setJumpProgress: (p: number) => void
}

export const useCarStore = create<CarState>((set) => ({
  z: 0,
  x: 0,
  speed: 0,
  jumpProgress: -1,
  set: (z, speed, x) => set({ z, speed, x }),
  setJumpProgress: (jumpProgress) => set({ jumpProgress }),
}))
