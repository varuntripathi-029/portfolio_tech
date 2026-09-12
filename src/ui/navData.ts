import { SECTIONS, type SectionId } from '../data/sections'
import { PROJECTS, ACHIEVEMENTS, EXPERIENCE } from '../data/content'
import type { WarpTarget } from '../state/raceStore'

/**
 * One row per card item, per spec 8: a nav row and a card item are now
 * one-to-one, so a click warps to the section AND opens the card on that
 * exact item, instead of several named rows resolving to the same stop the
 * way v1's chronological timeline did.
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

const DRIVER_ROWS: NavRow[] = [
  {
    year: '0m',
    label: 'Driver',
    note: 'Stack sheet, driver stats, and the education line.',
    target: { section: 'driver' },
  },
]

const PROJECT_ROWS: NavRow[] = PROJECTS.map((p, i) => ({
  year: p.timeline,
  label: p.title,
  note: p.oneLine,
  target: { section: 'projects', item: i },
}))

const ACHIEVEMENT_ROWS: NavRow[] = ACHIEVEMENTS.map((a, i) => ({
  year: a.date || a.result,
  label: a.title,
  note: a.description,
  target: { section: 'achievements', item: i },
}))

const EXPERIENCE_ROWS: NavRow[] = EXPERIENCE.map((e, i) => ({
  year: e.timeline,
  label: `${e.role}, ${e.org}`,
  note: e.bullets[0],
  target: { section: 'experience', item: i },
}))

const CONTACT_ROWS: NavRow[] = [
  {
    year: 'Finish',
    label: 'Contact',
    note: 'Every way to reach me, and what I am open to.',
    target: { section: 'contact' },
  },
]

const ROWS_BY_SECTION: Record<SectionId, NavRow[]> = {
  driver: DRIVER_ROWS,
  projects: PROJECT_ROWS,
  achievements: ACHIEVEMENT_ROWS,
  experience: EXPERIENCE_ROWS,
  contact: CONTACT_ROWS,
}

export const NAV_GROUPS: NavGroup[] = SECTIONS.map((section) => ({
  id: section.id,
  label: section.label,
  rows: ROWS_BY_SECTION[section.id],
}))
