import type { ProjectStatus } from '../data/timeline'

// Chip colour and race-control label from the spec's status table. The
// explanation line is separate and mandatory; the chip alone never carries
// the full meaning.
const CHIP: Record<NonNullable<ProjectStatus>, { label: string; color: string; explain: string }> = {
  LIVE: {
    label: 'GREEN FLAG',
    color: 'var(--color-flag-green)',
    explain: 'Deployed and reachable.',
  },
  ARCHIVED: {
    label: 'SESSION ENDED',
    color: 'var(--color-flag-yellow)',
    explain: 'Was deployed for the event, hosting access has since closed.',
  },
  BACKEND: {
    label: 'NO SPECTATORS',
    color: 'var(--color-smoke)',
    explain: 'Backend or CLI by design, nothing to deploy as a web UI.',
  },
  MOBILE: {
    label: 'PADDOCK ONLY',
    color: 'var(--color-flag-blue)',
    explain: 'Native mobile client, not available on the web.',
  },
}

/** The pill alone. Lives in the panel header strip. */
export function StatusChip({ status }: { status: NonNullable<ProjectStatus> }) {
  const chip = CHIP[status]
  return (
    <span
      className="inline-flex w-fit shrink-0 items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase"
      style={{ color: chip.color, borderColor: chip.color }}
    >
      <span className="inline-block h-1.5 w-1.5" style={{ background: chip.color }} />
      {chip.label}
    </span>
  )
}

/** The plain sentence. Required wherever a chip appears; the chip is shorthand,
 * never a substitute for saying what the status actually means. */
export function StatusExplain({ status }: { status: NonNullable<ProjectStatus> }) {
  return <p className="text-xs text-smoke">{CHIP[status].explain}</p>
}
