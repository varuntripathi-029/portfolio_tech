import { SECTIONS, type SectionId } from '../data/sections'
import type { WarpTarget } from '../state/raceStore'

/**
 * STAGE 2: one row per section, so the navbar keeps working while the card
 * content is out of the tree.
 *
 * Stage 4 replaces the rows with one per card item, which is the real win over
 * v1: a nav row and a card item become one-to-one, instead of several named
 * rows resolving to the same stop because the timeline had folded them
 * together.
 */

export interface NavRow {
  /** Mono timing column on the left of the dropdown row. */
  year: string
  label: string
  /**
   * One line. Deliberately not the card content: if the dropdown satisfies the
   * reader, nobody drives and the 3D becomes decoration.
   */
  note: string
  target: WarpTarget
}

export interface NavGroup {
  id: string
  label: string
  rows: NavRow[]
}

const NOTES: Record<SectionId, string> = {
  driver: 'Stack sheet, driver stats, and the education line.',
  projects: 'Nine builds, strongest first. HireSignal through the Java log analyzer.',
  achievements: 'Four hackathon results, two first places, LeetCode Knight, GenAI cert.',
  experience: 'The AI automation internship, then three leadership roles.',
  contact: 'Every way to reach me, and what I am open to.',
}

export const NAV_GROUPS: NavGroup[] = SECTIONS.map((section) => ({
  id: section.id,
  label: section.label,
  rows: [
    {
      year: `${section.s.toFixed(0)}m`,
      label: section.label,
      note: NOTES[section.id],
      target: { section: section.id },
    },
  ],
}))
