import { create } from 'zustand'
import type { SectionId } from '../data/sections'

const TUTORIAL_KEY = 'f1-portfolio-tutorial-seen'

function readTutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1'
  } catch {
    return false
  }
}

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
  /** Which item of activeSection's paged card is open. Reset to 0 on every
   * normal arrival; set from `warpTarget.item` on a navbar deep link, so a
   * warp opens on the requested item rather than always item 1 (spec 10.5). */
  activeItem: number
  /** Non-null only while phase is `warping`. */
  warpTarget: WarpTarget | null
  /**
   * True once the DRIVER card has been dismissed. The lights replay every lap
   * but the profile does not: forcing it in front of someone who has already
   * read it is friction, and the navbar reaches it.
   */
  driverSeen: boolean
  /** Block G: the onboarding card shown before DRIVER on a first visit.
   * Backed by localStorage so a returning visitor lands on DRIVER directly;
   * the navbar's "How to drive" entry can still set this back to false to
   * reopen it without touching that persisted flag. */
  tutorialSeen: boolean
  setPhase: (phase: RacePhase) => void
  setActiveSection: (section: SectionId | null) => void
  setActiveItem: (item: number) => void
  setDriverSeen: (seen: boolean) => void
  /** Dismissing (Enter or Skip) both closes it now and persists "seen" so it
   * never auto-shows again. Reopening from the navbar calls this with
   * `persist: false`, so the flag it just spent is not re-spent. */
  dismissTutorial: (persist?: boolean) => void
  reopenTutorial: () => void
  requestWarp: (target: WarpTarget) => void
  clearWarp: () => void
  /** Restores the pre-lap state without touching the mounted scene tree. */
  reset: () => void
}

export const useRaceStore = create<RaceState>((set) => ({
  phase: 'lights',
  activeSection: null,
  activeItem: 0,
  warpTarget: null,
  driverSeen: false,
  tutorialSeen: readTutorialSeen(),
  setPhase: (phase) => set({ phase }),
  setActiveSection: (activeSection) => set({ activeSection }),
  setActiveItem: (activeItem) => set({ activeItem }),
  setDriverSeen: (driverSeen) => set({ driverSeen }),
  dismissTutorial: (persist = true) => {
    if (persist) {
      try {
        localStorage.setItem(TUTORIAL_KEY, '1')
      } catch {
        /* private browsing or storage disabled: still dismisses for this session */
      }
    }
    set({ tutorialSeen: true })
  },
  reopenTutorial: () => set({ tutorialSeen: false }),
  requestWarp: (warpTarget) => set({ warpTarget, phase: 'warping' }),
  clearWarp: () => set({ warpTarget: null }),
  // driverSeen and tutorialSeen deliberately survive a reset: the lap rolls
  // over, neither the profile nor the onboarding card comes back on their own.
  reset: () => set({ phase: 'lights', activeSection: null, activeItem: 0, warpTarget: null }),
}))
