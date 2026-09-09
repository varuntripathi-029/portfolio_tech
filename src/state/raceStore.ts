import { create } from 'zustand'

export type RacePhase =
  | 'lights'
  | 'driving'
  | 'entering'
  | 'stopped'
  | 'leaving'
  | 'ended'
  | 'jumping'

/**
 * Where a navbar jump is headed. The nav is a shortcut layer over the
 * chronology, not a re-sectioning of it, so every target is a point on the
 * same single track.
 */
export type JumpTarget =
  | { kind: 'event'; index: number }
  | { kind: 'grid' }
  | { kind: 'end' }

interface RaceState {
  phase: RacePhase
  /** Index into TIMELINE of the event currently approached/shown; -1 before the first. */
  activeEventIndex: number
  /** True once the car has pulled out of the last event's pit stop, coasting to the end. */
  fuelLow: boolean
  /** Non-null only while phase is 'jumping'. */
  jumpTarget: JumpTarget | null
  setPhase: (phase: RacePhase) => void
  setActiveEventIndex: (i: number) => void
  setFuelLow: (v: boolean) => void
  requestJump: (target: JumpTarget) => void
  /** Restores the pre-race state without touching the mounted scene tree. */
  reset: () => void
}

export const useRaceStore = create<RaceState>((set) => ({
  phase: 'lights',
  activeEventIndex: -1,
  fuelLow: false,
  jumpTarget: null,
  setPhase: (phase) => set({ phase }),
  setActiveEventIndex: (activeEventIndex) => set({ activeEventIndex }),
  setFuelLow: (fuelLow) => set({ fuelLow }),
  requestJump: (jumpTarget) => set({ jumpTarget, phase: 'jumping' }),
  reset: () => set({ phase: 'lights', activeEventIndex: -1, fuelLow: false, jumpTarget: null }),
}))
