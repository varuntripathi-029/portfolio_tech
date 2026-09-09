import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { TimelineEvent } from '../data/timeline'
import { Panel, panelItem } from './Panel'
import { StatusChip, StatusExplain } from './StatusChip'
import { sectorLabel } from './sector'

/** Mono is reserved for numbers, labels and tags. Prose stays in the display face. */
function TechTags({ tech }: { tech: string[] }) {
  if (tech.length === 0) return null
  return (
    <motion.div variants={panelItem} className="mt-4 flex flex-wrap gap-1.5">
      {tech.map((t) => (
        <span
          key={t}
          className="border border-slate px-2 py-0.5 font-mono text-[10px] tracking-wide text-smoke uppercase"
        >
          {t}
        </span>
      ))}
    </motion.div>
  )
}

/** Three bullets maximum. This is read in about four seconds from a pit box. */
function Bullets({ bullets }: { bullets: string[] }) {
  if (bullets.length === 0) return null
  return (
    <motion.ul variants={panelItem} className="mt-4 space-y-2">
      {bullets.slice(0, 3).map((b) => (
        <li key={b} className="flex gap-2.5 text-sm leading-relaxed text-paper/80">
          <span className="mt-2 h-px w-3 shrink-0 bg-slate" />
          <span className="tabular">{b}</span>
        </li>
      ))}
    </motion.ul>
  )
}

/** Real anchors, mandatory: canvas clicks are invisible to keyboard, screen readers, crawlers. */
function LinkRow({ event }: { event: TimelineEvent }) {
  if (!event.liveUrl && !event.repoUrl) return null
  return (
    <motion.div
      variants={panelItem}
      className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs tracking-widest uppercase"
    >
      {event.liveUrl && (
        // Cyan marks live data. It is the one place it appears on a card, and
        // it is never set next to race-red.
        <a
          href={event.liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="border-b pb-0.5 text-paper transition-colors hover:text-[var(--color-hud-cyan)]"
          style={{ borderColor: 'var(--color-hud-cyan)' }}
        >
          Live Site &#8599;
        </a>
      )}
      {event.repoUrl && (
        <a
          href={event.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="border-b border-slate pb-0.5 text-smoke transition-colors hover:text-paper"
        >
          Repository &#8599;
        </a>
      )}
    </motion.div>
  )
}

/** Full bleed inside the panel padding. Images do not exist yet. */
function Screenshot({ src, title }: { src: string | null; title: string }) {
  return (
    <motion.div variants={panelItem} className="-mx-5 -mt-5 mb-5">
      {src ? (
        <img src={src} alt={title} className="h-[24vh] max-h-64 min-h-28 w-full object-cover" />
      ) : (
        // Height-capped rather than a free aspect ratio: at 16/9 across an
        // 880px card the media alone was ~500px and pushed the title, bullets
        // and links below the fold on a laptop.
        <div className="flex h-[24vh] max-h-64 min-h-28 w-full items-center justify-center border-b border-slate bg-carbon/60">
          <span className="font-mono text-[11px] tracking-[0.2em] text-slate uppercase">
            Screenshot Pending
          </span>
        </div>
      )}
    </motion.div>
  )
}

function Title({ event }: { event: TimelineEvent }) {
  return (
    <motion.div variants={panelItem}>
      <h2 className="text-3xl leading-none font-black tracking-tight text-paper uppercase">
        {event.title}
      </h2>
      <p className="mt-2.5 text-sm leading-relaxed text-paper/75">{event.oneLiner}</p>
    </motion.div>
  )
}

function ResumeHint() {
  return (
    <motion.p
      variants={panelItem}
      className="mt-7 border-t border-slate pt-4 font-mono text-[11px] tracking-[0.2em] text-smoke uppercase"
    >
      Press W to continue
    </motion.p>
  )
}

function HeaderLeft({ event }: { event: TimelineEvent }) {
  return (
    <>
      {sectorLabel(event.trackZ)} <span className="text-slate">/</span>{' '}
      <span className="tabular text-paper">{event.dateLabel}</span>
    </>
  )
}

function ProjectCard({ event }: { event: TimelineEvent }) {
  return (
    <Panel
      headerLeft={<HeaderLeft event={event} />}
      headerRight={event.status ? <StatusChip status={event.status} /> : undefined}
      className="w-full"
    >
      <Screenshot src={event.screenshot} title={event.title} />
      <Title event={event} />
      <Bullets bullets={event.bullets} />
      <TechTags tech={event.tech} />
      {event.status && (
        <motion.div variants={panelItem} className="mt-4">
          <StatusExplain status={event.status} />
        </motion.div>
      )}
      <LinkRow event={event} />
      <ResumeHint />
    </Panel>
  )
}

function ExperienceCard({ event }: { event: TimelineEvent }) {
  return (
    <Panel headerLeft={<HeaderLeft event={event} />} className="w-full">
      <Title event={event} />
      <Bullets bullets={event.bullets} />
      <TechTags tech={event.tech} />
      <ResumeHint />
    </Panel>
  )
}

/**
 * The Java to AI moment. Given more weight than its neighbours through the
 * radio framing and a larger title, not through extra colour.
 */
function PivotCard({ event }: { event: TimelineEvent }) {
  return (
    <Panel
      headerLeft={
        <span className="flex items-center gap-2">
          {/* CSS animation, so useReducedMotion does not cover it. */}
          <span className="inline-block h-1.5 w-1.5 animate-pulse bg-race-red motion-reduce:animate-none" />
          Team Radio <span className="text-slate">/</span>{' '}
          <span className="tabular text-paper">{event.dateLabel}</span>
        </span>
      }
      headerRight={event.status ? <StatusChip status={event.status} /> : undefined}
      className="w-full"
    >
      <motion.div variants={panelItem}>
        <h2 className="text-4xl leading-none font-black tracking-tight text-paper uppercase">
          {event.title}
        </h2>
        <p className="mt-4 border-l-2 border-slate pl-4 text-base leading-relaxed text-paper italic">
          &ldquo;{event.oneLiner}&rdquo;
        </p>
      </motion.div>
      <Bullets bullets={event.bullets} />
      <TechTags tech={event.tech} />
      {event.status && (
        <motion.div variants={panelItem} className="mt-4">
          <StatusExplain status={event.status} />
        </motion.div>
      )}
      <LinkRow event={event} />
      <ResumeHint />
    </Panel>
  )
}

/** DOM overlay, slides in from the right on stop, fades on resume. */
export function EventCard({ event }: { event: TimelineEvent | null }) {
  // Card content depends on motion to become visible, so an interrupted
  // animation would show an empty panel. initial={false} mounts at the end state.
  const reduce = useReducedMotion()

  return (
    <div className="pointer-events-none fixed top-1/2 right-8 z-20 w-[min(880px,58vw)] max-w-[calc(100vw-4rem)] -translate-y-1/2">
      <AnimatePresence mode="wait">
        {event && (
          <motion.div
            key={event.id}
            className="pointer-events-auto"
            initial={reduce ? false : { x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
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
