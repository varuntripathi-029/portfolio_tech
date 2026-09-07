import { create } from 'zustand'

export type RacePhase = 'lights' | 'driving' | 'entering' | 'stopped' | 'leaving' | 'ended'

interface RaceState {
  phase: RacePhase
  /** Index into TIMELINE of the event currently approached/shown; -1 before the first. */
  activeEventIndex: number
  /** True once the car has pulled out of the last event's pit stop, coasting to the end. */
  fuelLow: boolean
  setPhase: (phase: RacePhase) => void
  setActiveEventIndex: (i: number) => void
  setFuelLow: (v: boolean) => void
  /** Restores the pre-race state without touching the mounted scene tree. */
  reset: () => void
}

export const useRaceStore = create<RaceState>((set) => ({
  phase: 'lights',
  activeEventIndex: -1,
  fuelLow: false,
  setPhase: (phase) => set({ phase }),
  setActiveEventIndex: (activeEventIndex) => set({ activeEventIndex }),
  setFuelLow: (fuelLow) => set({ fuelLow }),
  reset: () => set({ phase: 'lights', activeEventIndex: -1, fuelLow: false }),
}))
