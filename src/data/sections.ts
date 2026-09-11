/**
 * The five sections and where they sit on the lap.
 *
 * Stage 2 carries ids, labels and stop positions only. All card content
 * arrives in Stage 4.
 */

import {
  CONTACT_BEFORE_LINE,
  DESIGN_LENGTH,
  STOP_SPECS,
  segmentById,
} from '../track/circuit'
import { TRACK_LENGTH, wrapS } from '../track/trackFrame'

export type SectionId = 'driver' | 'projects' | 'achievements' | 'experience' | 'contact'

export interface Section {
  id: SectionId
  label: string
  /** Arc length of the stop marker, in metres from the start/finish line. */
  s: number
  /**
   * 'grid' is the start/finish slot, reached by the lap rolling over rather
   * than by braking. 'stop' brakes to a marker. 'contact' is where the fuel
   * runs out.
   */
  kind: 'grid' | 'stop' | 'contact'
}

/**
 * The turtle path and the fitted spline differ in total length by a fraction
 * of a percent, because the spline cuts corner apexes very slightly. Design
 * offsets are scaled into measured arc length so a stop stays where it was
 * placed relative to its straight, instead of drifting further off with every
 * segment around the lap.
 */
const DESIGN_TO_MEASURED = TRACK_LENGTH / DESIGN_LENGTH

function stopS(segment: string, into: number): number {
  return wrapS((segmentById(segment).start + into) * DESIGN_TO_MEASURED)
}

export const SECTIONS: Section[] = [
  { id: 'driver', label: 'Driver', s: 0, kind: 'grid' },
  ...STOP_SPECS.map(
    (spec): Section => ({
      id: spec.id as SectionId,
      label: spec.label,
      s: stopS(spec.segment, spec.into),
      kind: 'stop',
    }),
  ),
  {
    id: 'contact',
    label: 'Contact',
    s: wrapS(TRACK_LENGTH - CONTACT_BEFORE_LINE),
    kind: 'contact',
  },
]

/** The four stops the car actually brakes for, in lap order. */
export const BRAKING_STOPS = SECTIONS.filter((x) => x.kind !== 'grid')

export function sectionById(id: SectionId): Section {
  const found = SECTIONS.find((x) => x.id === id)
  if (!found) throw new Error(`sections: no section with id "${id}"`)
  return found
}

export function sectionIndex(id: SectionId): number {
  return SECTIONS.findIndex((x) => x.id === id)
}
