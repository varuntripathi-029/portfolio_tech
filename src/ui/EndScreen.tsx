import { motion, useReducedMotion } from 'motion/react'
import { Panel, panelItem } from './Panel'

// Roles table copied verbatim from the spec, AI/ML first. "Open to", never
// "looking for". Short title plus at most one supporting clause each.
const ROLES = [
  { title: 'AI / ML Engineer', backedBy: 'RAG pipelines, LangGraph agents, ConvLSTM forecasting, LLM eval harnesses' },
  { title: 'Backend Engineer, Python', backedBy: 'FastAPI, Celery, PostgreSQL/pgvector, async SQLAlchemy' },
  { title: 'Backend Engineer, Java', backedBy: 'Spring Boot 3, JPA, Redis, 50 endpoint production service' },
  { title: 'Full Stack Engineer', backedBy: 'React 19, Next.js, TypeScript front ends over his own APIs' },
  { title: 'SDE, New Grad', backedBy: 'LeetCode Knight 1886, 300+ problems, 30+ public repos' },
]

const LINKS = [
  { label: 'GitHub', href: 'https://github.com/varuntripathi-029' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/varun-tripathi-bb338a295/' },
]

/**
 * No checkered flag, no finish gantry. This card is the ask, not a trophy.
 * Loop prompt text is exact per spec: PRESS W FOR ANOTHER LAP.
 */
export function EndScreen() {
  const reduce = useReducedMotion()

  return (
    <div className="pointer-events-none fixed top-1/2 right-8 z-20 w-[min(880px,58vw)] max-w-[calc(100vw-4rem)] -translate-y-1/2">
      <motion.div
        className="pointer-events-auto"
        initial={reduce ? false : { x: 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <Panel
          headerLeft="Fuel Low / Race Incomplete"
          headerRight={
            <span className="shrink-0 border border-race-red px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-race-red uppercase">
              Box This Lap
            </span>
          }
          className="w-full"
        >
          <motion.h1
            variants={panelItem}
            className="text-3xl leading-tight font-black tracking-tight text-paper uppercase"
          >
            Give me an internship to fuel my car and finish the race.
          </motion.h1>

          <motion.p
            variants={panelItem}
            className="mt-7 font-mono text-[11px] tracking-[0.22em] text-smoke uppercase"
          >
            Open to Roles Like
          </motion.p>
          <motion.ul variants={panelItem} className="mt-3 space-y-2.5">
            {ROLES.map((r) => (
              <li key={r.title} className="flex gap-3">
                <span className="mt-2.5 h-px w-3 shrink-0 bg-race-red" />
                <span>
                  <span className="block text-sm font-semibold text-paper">{r.title}</span>
                  <span className="block text-xs text-smoke">{r.backedBy}</span>
                </span>
              </li>
            ))}
          </motion.ul>

          <motion.div
            variants={panelItem}
            className="mt-7 border-t border-slate pt-4 font-mono text-xs text-smoke"
          >
            <p className="tabular">varun.tripathi2004@gmail.com</p>
            <p className="tabular mt-1">+91-9569680578</p>
            <div className="mt-3 flex gap-6 tracking-widest uppercase">
              {LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-b pb-0.5 text-paper transition-colors hover:text-[var(--color-hud-cyan)]"
                  style={{ borderColor: 'var(--color-hud-cyan)' }}
                >
                  {l.label} &#8599;
                </a>
              ))}
            </div>
          </motion.div>

          <motion.p variants={panelItem} className="mt-5 text-[11px] text-slate">
            SI RaceCar RC-12 by Dahie, Sketchfab, CC-BY.
          </motion.p>

          <motion.p
            variants={panelItem}
            className="mt-5 font-mono text-[11px] tracking-[0.2em] text-smoke uppercase"
          >
            Press W for another lap
          </motion.p>
        </Panel>
      </motion.div>
    </div>
  )
}
