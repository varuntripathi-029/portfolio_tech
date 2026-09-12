import { motion, useReducedMotion } from 'motion/react'
import { Panel, panelItem } from './Panel'

/**
 * The DRIVER card's content, shared between two very different contexts:
 * `StartSequence` shows it beside the car on the grid before the first W,
 * and `SectionCard` shows it inside the paged-card chrome when the navbar
 * warps here mid-lap (spec 3.1: "the navbar reaches it"). Both render the
 * same two panels; only the surrounding layout differs.
 */

interface Stat {
  label: string
  sub: string
  /** Bar length only. Never rendered as a number, this is not a measured stat. */
  weight: number
}

const STATS: Stat[] = [
  { label: 'Pace', sub: 'Backend engineering', weight: 92 },
  { label: 'Racecraft', sub: 'Frontend', weight: 78 },
  { label: 'Awareness', sub: 'AI / ML', weight: 88 },
  { label: 'Reliability', sub: 'Testing, TDD, 319 tests on HireSignal', weight: 85 },
  { label: 'Tyre Mgmt', sub: 'Systems and concurrency, 100k logs/sec', weight: 90 },
]

/** The garnish. Deliberately narrower than the spec sheet beside it, so the
 * substance reads as the main column rather than the two competing. */
export function DriverStats() {
  // Bars grow from width 0, so without this guard a skipped animation leaves
  // every bar empty rather than merely un-animated.
  const reduce = useReducedMotion()

  return (
    <Panel headerLeft="Driver" className="w-full">
      <div className="space-y-4">
        {STATS.map((s) => (
          <motion.div key={s.label} variants={panelItem}>
            <p className="font-mono text-[11px] tracking-widest text-paper uppercase">
              {s.label} <span className="text-smoke normal-case">/ {s.sub}</span>
            </p>
            <div className="mt-1.5 h-1 w-full bg-slate">
              <motion.div
                className="h-full bg-paper"
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${s.weight}%` }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </Panel>
  )
}

// F1-flavoured category labels over the real stack from about_tech.md. Not
// padded, not invented.
const SPEC_GROUPS: { label: string; items: string[] }[] = [
  { label: 'Languages', items: ['Python', 'Java 21', 'TypeScript', 'JavaScript', 'SQL'] },
  { label: 'Power Unit', items: ['FastAPI', 'Spring Boot 3', 'Celery', 'SQLAlchemy 2.0 async', 'Uvicorn'] },
  { label: 'Aero', items: ['React 19', 'Next.js', 'Tailwind v4', 'Zustand', 'React Three Fiber'] },
  { label: 'Telemetry', items: ['PostgreSQL + pgvector', 'Redis', 'MongoDB', 'ChromaDB', 'FAISS'] },
  { label: 'Strategy', items: ['Groq', 'LangGraph', 'CrewAI', 'PyTorch', 'sentence-transformers', 'RAG'] },
  { label: 'Garage', items: ['Docker', 'AWS', 'Linux', 'CI/CD', 'Vercel', 'Render', 'HuggingFace Spaces'] },
]

/** The more important half: a technical spec sheet of the actual skillset. */
export function CarSpecification() {
  return (
    <Panel
      headerLeft="Car Specification"
      headerRight={
        <span className="shrink-0 font-mono text-[10px] tracking-widest text-slate uppercase">
          RC-12
        </span>
      }
      className="w-full"
    >
      <div className="grid grid-cols-2 gap-x-7 gap-y-4">
        {SPEC_GROUPS.map((g) => (
          <motion.div key={g.label} variants={panelItem}>
            <p className="font-mono text-[10px] tracking-[0.2em] text-race-red uppercase">{g.label}</p>
            <p className="mt-1.5 font-mono text-xs leading-relaxed text-paper">{g.items.join(' / ')}</p>
          </motion.div>
        ))}
      </div>
      <motion.div
        variants={panelItem}
        className="mt-5 space-y-1 border-t border-slate pt-4 font-mono text-xs text-smoke"
      >
        <p className="tabular">B.Tech ECE (IoT), IIIT Nagpur. 2023 to 2027.</p>
        <p className="tabular">LeetCode Knight, rating 1886. 300+ problems. 40+ public repos.</p>
      </motion.div>
    </Panel>
  )
}

/** The two panels stacked, as used inside the paged-card chrome on a warp. */
export function DriverProfileBody() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-xs tracking-[0.3em] text-smoke uppercase">Varun Tripathi</p>
        <h2 className="mt-1 text-4xl font-black tracking-tight text-paper uppercase">Race Engineer</h2>
      </div>
      <DriverStats />
      <CarSpecification />
    </div>
  )
}
