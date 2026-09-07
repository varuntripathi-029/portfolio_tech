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
  set: (z: number, speed: number, x: number) => void
}

export const useCarStore = create<CarState>((set) => ({
  z: 0,
  x: 0,
  speed: 0,
  set: (z, speed, x) => set({ z, speed, x }),
}))
