import { create } from 'zustand'
import type { SectionId } from '../data/sections'

/**
 * `lights` is the grid, waiting for the first W. Only ever visited once, on
 * load: every later lap reaches the grid already moving into `launching`.
 * `launching` is the 3-2-1 countdown plus the front-to-chase camera orbit,
 * ending in `driving` on its own timer.
 * `driving` covers everything from lights out to the next braking zone.
 * `arriving` is the automatic 5g stop into a section marker.
 * `stopped` is a section card being read.
 * `warping` is a navbar jump, forward around the loop.
 * `dry` is the CONTACT stop, where the fuel has run out.
 * `creeping` is the short refuelled roll from CONTACT back to the grid slot,
 * which flows straight into `launching` for the next lap with no second W.
 */
export type RacePhase =
  | 'lights'
  | 'launching'
  | 'driving'
  | 'arriving'
  | 'stopped'
  | 'warping'
  | 'dry'
  | 'creeping'

/** Where a navbar warp is headed. Every target is a section on the same lap. */
export interface WarpTarget {
  section: SectionId
  /** Which item of that section to open on arrival. Stage 4 uses it. */
  item?: number
}

interface RaceState {
  phase: RacePhase
  /** The section being approached or read, or null while free driving. */
  activeSection: SectionId | null
  /** Non-null only while phase is `warping`. */
  warpTarget: WarpTarget | null
  /**
   * True once the DRIVER card has been dismissed. The lights replay every lap
   * but the profile does not: forcing it in front of someone who has already
   * read it is friction, and the navbar reaches it.
   */
  driverSeen: boolean
  setPhase: (phase: RacePhase) => void
  setActiveSection: (section: SectionId | null) => void
  setDriverSeen: (seen: boolean) => void
  requestWarp: (target: WarpTarget) => void
  clearWarp: () => void
  /** Restores the pre-lap state without touching the mounted scene tree. */
  reset: () => void
}

export const useRaceStore = create<RaceState>((set) => ({
  phase: 'lights',
  activeSection: null,
  warpTarget: null,
  driverSeen: false,
  setPhase: (phase) => set({ phase }),
  setActiveSection: (activeSection) => set({ activeSection }),
  setDriverSeen: (driverSeen) => set({ driverSeen }),
  requestWarp: (warpTarget) => set({ warpTarget, phase: 'warping' }),
  clearWarp: () => set({ warpTarget: null }),
  // driverSeen deliberately survives a reset: the lap rolls over, the profile
  // does not come back.
  reset: () => set({ phase: 'lights', activeSection: null, warpTarget: null }),
}))
