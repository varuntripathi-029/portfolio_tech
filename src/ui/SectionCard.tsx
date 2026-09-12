import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { FiCopy, FiCheck } from 'react-icons/fi'
import { Panel, panelItem } from './Panel'
import { DriverProfileBody } from './DriverProfile'
import { sectionById } from '../data/sections'
import { useRaceStore } from '../state/raceStore'
import { useCarStore } from '../state/carStore'
import { StatusChip, StatusExplain } from './StatusChip'
import {
  PROJECTS,
  ACHIEVEMENTS,
  EXPERIENCE,
  ROLES,
  CONTACT_LINKS,
  CREDITS,
  type ProjectItem,
  type AchievementItem,
  type ExperienceItem,
} from '../data/content'

/**
 * The real, glass, paged section card (spec 10). One Panel per open section:
 * DRIVER and CONTACT are single fixed layouts (no paging, per 3.2 and 3.6),
 * PROJECTS / ACHIEVEMENTS / EXPERIENCE are the paged item-list-plus-detail
 * layout from 10.5. Panel already supplies the real backdrop-filter, the
 * chamfer, the hover light and the arrival-flash sweep (see Panel.tsx); this
 * file only supplies the content and the paging.
 */

// Block G4: full width under the mobile breakpoint, the normal desktop
// sizing from there up.
const CARD_WIDTH = 'w-[92vw] sm:w-[min(960px,62vw)]'

/** Arrow keys page the open card (spec 6.7), same focus-gate the drive input
 * uses: the navbar owns the keyboard while one of its controls has focus. */
function usePageKeys(count: number, onStep: (dir: -1 | 1) => void) {
  useEffect(() => {
    if (count <= 1) return
    const navHasFocus = () => Boolean(document.activeElement?.closest('[data-nav-root]'))
    const onKey = (e: KeyboardEvent) => {
      if (navHasFocus()) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') onStep(1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') onStep(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, onStep])
}

/** Fires the sleeping-backend warm-up requests once per PROJECTS open, per
 * spec 14 Q8: nothing is linked, this just gets a cold HF Space moving before
 * anyone clicks through, so the frontend link is responsive by then. */
function useProjectWarmup(active: boolean) {
  const fired = useRef(false)
  useEffect(() => {
    if (!active) {
      fired.current = false
      return
    }
    if (fired.current) return
    fired.current = true
    for (const p of PROJECTS) {
      for (const url of p.warmupUrls ?? []) {
        fetch(url, { mode: 'no-cors' }).catch(() => {
          /* Sleeping backend, slow network, or a CORS-opaque response: all
           * fine, this is a fire-and-forget nudge, not a data dependency. */
        })
      }
    }
  }, [active])
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (key: string, text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(key)
        window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600)
      })
      .catch(() => {
        /* Clipboard permission denied or unavailable: the button still shows
         * the string, which is the fallback the spec asks for. */
      })
  }
  return { copied, copy }
}

function ListRail({
  items,
  activeIndex,
  onPick,
}: {
  items: { title: string; sub: string }[]
  activeIndex: number
  onPick: (i: number) => void
}) {
  return (
    <ul className="max-h-[56vh] w-[220px] shrink-0 space-y-1 overflow-y-auto border-r border-slate pr-3">
      {items.map((it, i) => (
        <li key={it.title}>
          <button
            type="button"
            onClick={() => onPick(i)}
            aria-current={i === activeIndex}
            // Block G5: the active row's left bar gets a soft glow rather
            // than reading as a flat red block, and hovering any row lifts
            // it 2px and brightens it instead of just a colour change.
            className={`focus-ring chamfer-sm block w-full -translate-y-0 px-3 py-2 text-left transition-all duration-150 hover:-translate-y-0.5 ${
              i === activeIndex
                ? 'bg-[rgba(225,6,0,0.12)] text-paper shadow-[inset_3px_0_0_0_var(--color-race-red),-2px_0_10px_-2px_rgba(225,6,0,0.55)]'
                : 'text-smoke hover:bg-[rgba(247,244,241,0.07)] hover:text-paper'
            }`}
          >
            <span className="font-mono text-[10px] tracking-widest text-slate uppercase">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="block truncate text-[13px] leading-tight font-semibold">{it.title}</span>
            <span className="block truncate text-[11px] text-smoke">{it.sub}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * The card visual, per spec 1.8: a preloaded static screenshot, never a live
 * embed. `screenshot` items were captured by `scripts/shoot.ts`; the other
 * three kinds have no real site to shoot (a mobile app, a platform whose
 * hosting closed, and a CLI tool), so each gets a small in-card mockup
 * instead of a placeholder box.
 */
function ProjectVisual({ item }: { item: ProjectItem }) {
  if (item.visualKind === 'screenshot') {
    return (
      <div className="chamfer-sm overflow-hidden border border-slate">
        <img
          src={`/projects/${item.id}.webp`}
          alt={`${item.title} screenshot`}
          className="aspect-[1024/640] w-full object-cover object-top"
          loading="lazy"
        />
      </div>
    )
  }
  if (item.visualKind === 'phone') {
    return (
      <div className="flex h-40 items-center justify-center border border-slate bg-graphite">
        <div className="chamfer-sm flex h-32 w-16 flex-col items-center justify-center gap-2 border-2 border-smoke bg-carbon">
          <span className="h-1 w-4 bg-slate" />
          <span className="font-mono text-[8px] tracking-widest text-smoke uppercase">Mobile</span>
        </div>
      </div>
    )
  }
  if (item.visualKind === 'diagram') {
    return (
      <div className="grid h-40 grid-cols-5 gap-1.5 border border-slate bg-graphite p-3">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="chamfer-sm flex items-center justify-center border border-slate bg-carbon">
            <span className="h-1.5 w-1.5 bg-[var(--color-hud-cyan)]" />
          </div>
        ))}
      </div>
    )
  }
  // terminal
  return (
    <div className="h-40 space-y-1 overflow-hidden border border-slate bg-black px-3 py-2 font-mono text-[11px] text-flag-green">
      <p>$ ./log-analyzer --threads 12 --queue 65536</p>
      <p>[ingest] 100,000 logs/sec sustained</p>
      <p>[window] 60s vs 5m baseline: within tolerance</p>
      <p className="animate-pulse">_</p>
    </div>
  )
}

function ProjectDetail({ item }: { item: ProjectItem }) {
  return (
    <motion.div key={item.id} variants={panelItem} initial="hidden" animate="show" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-4xl font-black tracking-tight text-paper uppercase">{item.title}</h3>
          <p className="mt-1 font-mono text-xs tracking-widest text-smoke uppercase">{item.timeline}</p>
        </div>
        <StatusChip status={item.status} />
      </div>
      <StatusExplain status={item.status} />
      <ProjectVisual item={item} />
      <p className="text-base leading-relaxed text-paper">{item.oneLine}</p>

      {item.pivot && (
        // The team-radio treatment: the one surviving piece of the old
        // chronological narrative spine, per spec 3.3. Deliberately the only
        // card styled this way.
        <div className="chamfer-sm border border-race-red bg-[rgba(225,6,0,0.08)] px-4 py-3">
          <p className="font-mono text-[10px] tracking-[0.25em] text-race-red uppercase">Team radio, box box</p>
          <p className="mt-1.5 font-mono text-[13px] leading-relaxed text-paper">
            "Copy that, box. TTFT down from {item.pivot.ttft}. Retrieval up {item.pivot.retrieval}. Switching to
            Python, we are go."
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {item.stack.map((s) => (
          <span
            key={s}
            className="chamfer-sm border border-slate px-2 py-0.5 font-mono text-xs text-smoke uppercase"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        {item.liveUrl ? (
          <a
            href={item.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring chamfer-sm border border-flag-green px-4 py-2 font-mono text-xs tracking-widest text-flag-green uppercase transition-colors hover:bg-[rgba(0,210,106,0.1)]"
          >
            View live
          </a>
        ) : (
          <a
            href={item.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring chamfer-sm border border-slate px-4 py-2 font-mono text-xs tracking-widest text-paper uppercase transition-colors hover:bg-[rgba(247,244,241,0.08)]"
          >
            View repo
          </a>
        )}
        {item.liveUrl && (
          <a
            href={item.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring chamfer-sm border border-slate px-4 py-2 font-mono text-xs tracking-widest text-smoke uppercase transition-colors hover:text-paper"
          >
            Repo
          </a>
        )}
        {item.secondaryLink && (
          <a
            href={item.secondaryLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring chamfer-sm border border-slate px-4 py-2 font-mono text-xs tracking-widest text-smoke uppercase transition-colors hover:text-paper"
          >
            {item.secondaryLink.label}
          </a>
        )}
      </div>
    </motion.div>
  )
}

function AchievementDetail({ item }: { item: AchievementItem }) {
  const requestWarp = useRaceStore((s) => s.requestWarp)
  const linkedIndex = item.linkedProject ? PROJECTS.findIndex((p) => p.id === item.linkedProject) : -1

  return (
    <motion.div key={item.id} variants={panelItem} initial="hidden" animate="show" className="space-y-4">
      <div>
        <h3 className="text-4xl font-black tracking-tight text-paper uppercase">{item.title}</h3>
        <p className="mt-1 font-mono text-xs tracking-widest text-race-red uppercase">
          {item.result}
          {item.date ? ` / ${item.date}` : ''}
        </p>
      </div>
      <p className="text-base leading-relaxed text-paper">{item.description}</p>
      <div className="flex flex-wrap gap-3 pt-1">
        {item.repoUrl && (
          <a
            href={item.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring chamfer-sm border border-slate px-4 py-2 font-mono text-xs tracking-widest text-paper uppercase transition-colors hover:bg-[rgba(247,244,241,0.08)]"
          >
            View repo
          </a>
        )}
        {item.verifyUrl && (
          <a
            href={item.verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring chamfer-sm border border-slate px-4 py-2 font-mono text-xs tracking-widest text-paper uppercase transition-colors hover:bg-[rgba(247,244,241,0.08)]"
          >
            Verify certificate
          </a>
        )}
        {linkedIndex >= 0 && (
          <button
            type="button"
            onClick={() => requestWarp({ section: 'projects', item: linkedIndex })}
            className="focus-ring chamfer-sm border border-[var(--color-hud-cyan)] px-4 py-2 font-mono text-xs tracking-widest text-[var(--color-hud-cyan)] uppercase transition-all hover:bg-[rgba(0,224,255,0.1)] hover:shadow-[0_0_16px_rgba(0,224,255,0.4)]"
          >
            Open project card
          </button>
        )}
      </div>
    </motion.div>
  )
}

function ExperienceDetail({ item }: { item: ExperienceItem }) {
  return (
    <motion.div key={item.id} variants={panelItem} initial="hidden" animate="show" className="space-y-4">
      <div>
        <h3 className="text-4xl font-black tracking-tight text-paper uppercase">{item.role}</h3>
        <p className="mt-1 font-mono text-xs tracking-widest text-smoke uppercase">
          {item.org} / {item.mode} / {item.timeline}
        </p>
      </div>
      <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-paper">
        {item.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {item.correction && (
        <p className="font-mono text-[11px] tracking-widest text-slate uppercase">Corrects the source: {item.correction}</p>
      )}
    </motion.div>
  )
}

function ProjectsCard({ activeItem }: { activeItem: number }) {
  const setActiveItem = useRaceStore((s) => s.setActiveItem)
  const clampedIndex = Math.min(activeItem, PROJECTS.length - 1)
  useProjectWarmup(true)
  usePageKeys(PROJECTS.length, (dir) =>
    setActiveItem(Math.max(0, Math.min(PROJECTS.length - 1, clampedIndex + dir))),
  )
  return (
    <Panel
      headerLeft="Projects"
      headerRight={
        <span className="shrink-0 font-mono text-[10px] tracking-widest text-slate uppercase">
          {clampedIndex + 1} / {PROJECTS.length}
        </span>
      }
      className={CARD_WIDTH}
    >
      <div className="flex gap-5">
        <ListRail
          items={PROJECTS.map((p) => ({ title: p.title, sub: p.timeline }))}
          activeIndex={clampedIndex}
          onPick={setActiveItem}
        />
        <div className="min-w-0 flex-1">
          <ProjectDetail item={PROJECTS[clampedIndex]} />
        </div>
      </div>
    </Panel>
  )
}

function AchievementsCard({ activeItem }: { activeItem: number }) {
  const setActiveItem = useRaceStore((s) => s.setActiveItem)
  const clampedIndex = Math.min(activeItem, ACHIEVEMENTS.length - 1)
  usePageKeys(ACHIEVEMENTS.length, (dir) =>
    setActiveItem(Math.max(0, Math.min(ACHIEVEMENTS.length - 1, clampedIndex + dir))),
  )
  return (
    <Panel
      headerLeft="Achievements"
      headerRight={
        <span className="shrink-0 font-mono text-[10px] tracking-widest text-slate uppercase">
          {clampedIndex + 1} / {ACHIEVEMENTS.length}
        </span>
      }
      className={CARD_WIDTH}
    >
      <div className="flex gap-5">
        <ListRail
          items={ACHIEVEMENTS.map((a) => ({ title: a.title, sub: a.result }))}
          activeIndex={clampedIndex}
          onPick={setActiveItem}
        />
        <div className="min-w-0 flex-1">
          <AchievementDetail item={ACHIEVEMENTS[clampedIndex]} />
        </div>
      </div>
    </Panel>
  )
}

function ExperienceCard({ activeItem }: { activeItem: number }) {
  const setActiveItem = useRaceStore((s) => s.setActiveItem)
  const clampedIndex = Math.min(activeItem, EXPERIENCE.length - 1)
  usePageKeys(EXPERIENCE.length, (dir) =>
    setActiveItem(Math.max(0, Math.min(EXPERIENCE.length - 1, clampedIndex + dir))),
  )
  return (
    <Panel
      headerLeft="Experience"
      headerRight={
        <span className="shrink-0 font-mono text-[10px] tracking-widest text-slate uppercase">
          {clampedIndex + 1} / {EXPERIENCE.length}
        </span>
      }
      className={CARD_WIDTH}
    >
      <div className="flex gap-5">
        <ListRail
          items={EXPERIENCE.map((e) => ({ title: e.role, sub: e.org }))}
          activeIndex={clampedIndex}
          onPick={setActiveItem}
        />
        <div className="min-w-0 flex-1">
          <ExperienceDetail item={EXPERIENCE[clampedIndex]} />
        </div>
      </div>
    </Panel>
  )
}

function CopyButton({ id, text, label }: { id: string; text: string; label: string }) {
  const { copied, copy } = useCopy()
  return (
    <button
      type="button"
      onClick={() => copy(id, text)}
      aria-label={`Copy ${label}`}
      className="focus-ring chamfer-sm flex items-center gap-1.5 border border-slate px-2.5 py-1.5 font-mono text-[11px] text-smoke uppercase transition-colors hover:text-paper"
    >
      {copied === id ? (
        <>
          <FiCheck aria-hidden /> Copied
        </>
      ) : (
        <>
          <FiCopy aria-hidden /> Copy
        </>
      )}
    </button>
  )
}

const BEST_LAP_KEY = 'f1-portfolio-best-lap-ms'
const BEST_DRIFT_KEY = 'f1-portfolio-best-drift'

function formatLapTime(ms: number): string {
  const totalMs = Math.max(0, Math.floor(ms))
  const minutes = Math.floor(totalMs / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const millis = totalMs % 1000
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

/**
 * This lap's time and drift score against a localStorage best, read once
 * when CONTACT opens: `lapElapsedMs` and `driftScore` are both frozen by
 * then (the timer pauses on a card, the sim never resets score itself), so
 * a one-time read at mount is exactly the final figure for the lap just
 * driven, no subscription needed.
 */
function LapAndDriftStats() {
  const [stats] = useState(() => {
    const { lapElapsedMs, driftScore } = useCarStore.getState()
    let bestLap = Infinity
    let bestDrift = 0
    try {
      const storedLap = localStorage.getItem(BEST_LAP_KEY)
      const storedDrift = localStorage.getItem(BEST_DRIFT_KEY)
      if (storedLap) bestLap = parseFloat(storedLap)
      if (storedDrift) bestDrift = parseFloat(storedDrift)
    } catch {
      /* private browsing or storage disabled: no best to compare against */
    }
    const newBestLap = lapElapsedMs > 0 && lapElapsedMs < bestLap
    const newBestDrift = driftScore > bestDrift
    try {
      if (newBestLap) localStorage.setItem(BEST_LAP_KEY, String(lapElapsedMs))
      if (newBestDrift) localStorage.setItem(BEST_DRIFT_KEY, String(driftScore))
    } catch {
      /* same as above: the session still shows the right numbers either way */
    }
    return {
      lapElapsedMs,
      driftScore,
      bestLap: newBestLap ? lapElapsedMs : bestLap,
      bestDrift: newBestDrift ? driftScore : bestDrift,
      newBestLap,
      newBestDrift,
    }
  })

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="chamfer-sm border border-slate px-4 py-3">
        <p className="font-mono text-[10px] tracking-widest text-smoke uppercase">
          Lap time {stats.newBestLap && <span className="text-race-red">/ NEW BEST</span>}
        </p>
        <p className="tabular mt-1 font-mono text-2xl font-bold text-paper">
          {formatLapTime(stats.lapElapsedMs)}
        </p>
        {Number.isFinite(stats.bestLap) && (
          <p className="tabular mt-0.5 font-mono text-[11px] text-smoke">
            Best {formatLapTime(stats.bestLap)}
          </p>
        )}
      </div>
      <div className="chamfer-sm border border-slate px-4 py-3">
        <p className="font-mono text-[10px] tracking-widest text-smoke uppercase">
          Drift score {stats.newBestDrift && stats.driftScore > 0 && (
            <span className="text-race-red">/ NEW BEST</span>
          )}
        </p>
        <p className="tabular mt-1 font-mono text-2xl font-bold text-[var(--color-hud-cyan)]">
          {Math.round(stats.driftScore)}
        </p>
        <p className="tabular mt-0.5 font-mono text-[11px] text-smoke">
          Best {Math.round(stats.bestDrift)}
        </p>
      </div>
    </div>
  )
}

/**
 * The loudest surface in the experience, per spec 3.6: v1 buried this in a
 * modest end-of-road panel, v2 does not. Large buttons, generous hit areas,
 * the roles block at equal size to the buttons, never a plea.
 */
function ContactCard() {
  return (
    <Panel headerLeft="Contact" className={CARD_WIDTH}>
      <div className="space-y-7">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-race-red uppercase">Box box, radio check</p>
          <h3 className="mt-2 text-4xl leading-tight font-black tracking-tight text-paper uppercase sm:text-[44px]">
            Give me an internship to fuel my car and finish the race.
          </h3>
        </div>

        <LapAndDriftStats />
        <div className="grid grid-cols-2 gap-3">
          <a
            href={CONTACT_LINKS.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring chamfer-sm border border-[var(--color-hud-cyan)] px-5 py-4 text-center font-mono text-sm font-bold tracking-widest text-[var(--color-hud-cyan)] uppercase transition-all hover:bg-[rgba(0,224,255,0.1)] hover:shadow-[0_0_16px_rgba(0,224,255,0.4)]"
          >
            LinkedIn
          </a>
          <a
            href={CONTACT_LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring chamfer-sm border border-[var(--color-hud-cyan)] px-5 py-4 text-center font-mono text-sm font-bold tracking-widest text-[var(--color-hud-cyan)] uppercase transition-all hover:bg-[rgba(0,224,255,0.1)] hover:shadow-[0_0_16px_rgba(0,224,255,0.4)]"
          >
            GitHub
          </a>

          <div className="chamfer-sm flex items-center justify-between gap-2 border border-slate px-4 py-3">
            <a href={`mailto:${CONTACT_LINKS.email}`} className="focus-ring truncate font-mono text-xs text-paper">
              {CONTACT_LINKS.email}
            </a>
            <CopyButton id="email" text={CONTACT_LINKS.email} label="email address" />
          </div>
          <div className="chamfer-sm flex items-center justify-between gap-2 border border-slate px-4 py-3">
            <a href={`tel:${CONTACT_LINKS.phone}`} className="focus-ring truncate font-mono text-xs text-paper">
              {CONTACT_LINKS.phoneDisplay}
            </a>
            <CopyButton id="phone" text={CONTACT_LINKS.phoneDisplay} label="phone number" />
          </div>
        </div>

        <div>
          <p className="font-mono text-xs tracking-[0.25em] text-smoke uppercase">Open to roles like</p>
          <div className="mt-3 space-y-2.5">
            {ROLES.map((r) => (
              <div key={r.role} className="flex flex-wrap items-baseline gap-x-2 border-b border-slate/60 pb-2">
                <span className="text-base font-bold text-paper">{r.role}</span>
                <span className="text-sm text-smoke">/ {r.backedBy}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="font-mono text-[10px] tracking-widest text-slate uppercase">
          {CREDITS.map((c) => `${c.work}, ${c.author} (${c.license})`).join('  /  ')}
        </p>
      </div>
    </Panel>
  )
}

function DriverCard() {
  return (
    <div className={`${CARD_WIDTH} max-h-[80vh] overflow-y-auto`}>
      <DriverProfileBody />
    </div>
  )
}

export function SectionCard() {
  const phase = useRaceStore((s) => s.phase)
  const activeSection = useRaceStore((s) => s.activeSection)
  const activeItem = useRaceStore((s) => s.activeItem)
  const reduce = useReducedMotion()

  const showing = phase === 'stopped' || phase === 'dry'
  if (!showing || !activeSection) return null

  const section = sectionById(activeSection)

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center px-6">
      <motion.div
        key={activeSection}
        // Degrades to visible, never to hidden: if motion fails the reader
        // still gets the card.
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="pointer-events-auto max-h-[80vh] overflow-visible"
      >
        {section.id === 'driver' && <DriverCard />}
        {section.id === 'projects' && <ProjectsCard activeItem={activeItem} />}
        {section.id === 'achievements' && <AchievementsCard activeItem={activeItem} />}
        {section.id === 'experience' && <ExperienceCard activeItem={activeItem} />}
        {section.id === 'contact' && <ContactCard />}
      </motion.div>
    </div>
  )
}
