import { AnimatePresence, motion } from 'motion/react'
import type { TimelineEvent } from '../data/timeline'
import { StatusChip } from './StatusChip'

function TechTags({ tech }: { tech: string[] }) {
  if (tech.length === 0) return null
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tech.map((t) => (
        <span
          key={t}
          className="border border-slate px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-smoke"
        >
          {t}
        </span>
      ))}
    </div>
  )
}

function Bullets({ bullets }: { bullets: string[] }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {bullets.map((b) => (
        <li key={b} className="flex gap-2 text-sm text-paper/80">
          <span className="text-race-red">/</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  )
}

/** Real anchors, mandatory: canvas clicks are invisible to keyboard, screen readers, crawlers. */
function LinkRow({ event }: { event: TimelineEvent }) {
  if (!event.liveUrl && !event.repoUrl) return null
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-widest">
      {event.liveUrl && (
        <a
          href={event.liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="border-b-2 border-race-red pb-0.5 text-paper hover:text-race-red"
        >
          View Live
        </a>
      )}
      {event.repoUrl && (
        <a
          href={event.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="border-b border-smoke pb-0.5 text-smoke hover:text-paper"
        >
          Repo
        </a>
      )}
    </div>
  )
}

function ScreenshotPlaceholder() {
  return (
    <div className="chamfer-sm mb-3 flex h-40 w-full items-center justify-center border border-slate bg-carbon">
      <span className="font-mono text-[11px] uppercase tracking-widest text-smoke">Screenshot Pending</span>
    </div>
  )
}

function DateLabel({ children }: { children: string }) {
  return <p className="tabular font-mono text-xs uppercase tracking-widest text-smoke">{children}</p>
}

function ResumeHint({ label }: { label: string }) {
  return <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-smoke">{label}</p>
}

function ProjectCard({ event }: { event: TimelineEvent }) {
  return (
    <div className="chamfer w-[400px] border-l-4 border-race-red bg-graphite p-6">
      <ScreenshotPlaceholder />
      <DateLabel>{event.dateLabel}</DateLabel>
      <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-paper">{event.title}</h2>
      <p className="mt-2 text-sm text-paper/80">{event.oneLiner}</p>
      <TechTags tech={event.tech} />
      {event.status && <div className="mt-4">{<StatusChip status={event.status} />}</div>}
      <LinkRow event={event} />
      <ResumeHint label="Press W to continue" />
    </div>
  )
}

function ExperienceCard({ event }: { event: TimelineEvent }) {
  return (
    <div className="chamfer w-[380px] border-l-4 border-slate bg-graphite p-6">
      <DateLabel>{event.dateLabel}</DateLabel>
      <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-paper">{event.title}</h2>
      <p className="mt-2 text-sm text-paper/80">{event.oneLiner}</p>
      <Bullets bullets={event.bullets} />
      <ResumeHint label="Press W to continue" />
    </div>
  )
}

function PivotCard({ event }: { event: TimelineEvent }) {
  return (
    <div className="chamfer w-[420px] border-2 border-race-red bg-carbon p-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse bg-race-red" />
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-race-red">Team Radio</p>
      </div>
      <DateLabel>{event.dateLabel}</DateLabel>
      <h2 className="mt-1 text-3xl font-black uppercase tracking-tight text-paper">{event.title}</h2>
      <p className="mt-3 text-base text-paper italic">&ldquo;{event.oneLiner}&rdquo;</p>
      <div className="mt-4 border-t border-slate pt-3">
        <Bullets bullets={event.bullets} />
      </div>
      <TechTags tech={event.tech} />
      {event.status && <div className="mt-4">{<StatusChip status={event.status} />}</div>}
      <LinkRow event={event} />
      <ResumeHint label="Press W to continue" />
    </div>
  )
}

/** DOM overlay, slides in from the right on stop, fades on resume. */
export function EventCard({ event }: { event: TimelineEvent | null }) {
  return (
    <div className="pointer-events-none fixed top-1/2 right-8 z-20 -translate-y-1/2">
      <AnimatePresence>
        {event && (
          <motion.div
            key={event.id}
            className="pointer-events-auto"
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {event.kind === 'project' && <ProjectCard event={event} />}
            {event.kind === 'experience' && <ExperienceCard event={event} />}
            {event.kind === 'pivot' && <PivotCard event={event} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
