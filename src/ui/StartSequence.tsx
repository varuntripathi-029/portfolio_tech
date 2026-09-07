import { useEffect, useState } from 'react'

const LIGHT_INTERVAL = 550

/** 3-2-1 red lights, illuminate in sequence then go dark together. Replays every lap. */
function StartLights() {
  const [lit, setLit] = useState(0) // 0..3 lit, -1 = lights out

  useEffect(() => {
    if (lit === -1) return
    const delay = lit >= 3 ? 500 : LIGHT_INTERVAL
    const t = setTimeout(() => setLit((c) => (c >= 3 ? -1 : c + 1)), delay)
    return () => clearTimeout(t)
  }, [lit])

  return (
    <div className="flex gap-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="chamfer-sm h-7 w-7 border border-slate"
          style={{ background: lit > i ? 'var(--color-race-red)' : 'var(--color-graphite)' }}
        />
      ))}
    </div>
  )
}

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

function DriverStats() {
  return (
    <div className="w-96">
      <p className="font-mono text-xs tracking-[0.25em] text-smoke uppercase">Driver</p>
      <div className="mt-2 space-y-3 border-t border-slate pt-3">
        {STATS.map((s) => (
          <div key={s.label}>
            <p className="font-mono text-xs tracking-widest text-paper uppercase">
              {s.label} <span className="text-smoke normal-case">/ {s.sub}</span>
            </p>
            <div className="mt-1 h-1.5 w-full bg-slate">
              <div className="h-full bg-paper" style={{ width: `${s.weight}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
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
function CarSpecification() {
  return (
    <div className="w-[440px]">
      <p className="font-mono text-xs tracking-[0.25em] text-smoke uppercase">Car Specification</p>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate pt-3">
        {SPEC_GROUPS.map((g) => (
          <div key={g.label}>
            <p className="font-mono text-[11px] tracking-widest text-race-red uppercase">{g.label}</p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-paper">{g.items.join(' / ')}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1 border-t border-slate pt-3 font-mono text-xs text-smoke">
        <p>B.Tech ECE (IoT), IIIT Nagpur. 2023 to 2027.</p>
        <p className="tabular">LeetCode Knight, rating 1886. 300+ problems. 30+ public repos.</p>
      </div>
    </div>
  )
}

/**
 * Grid, lights, and the driver profile. Reachable on every lap (see
 * raceStore.reset()), so this is the profile page, not a loading splash.
 */
export function StartSequence() {
  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center gap-8 overflow-y-auto bg-carbon/85 px-6 py-10">
      <div>
        <p className="text-center font-mono text-xs tracking-[0.3em] text-smoke uppercase">Varun Tripathi</p>
        <h1 className="mt-1 text-center text-4xl font-black tracking-tight text-paper uppercase">
          Race Engineer
        </h1>
      </div>

      <StartLights />

      <div className="flex flex-wrap justify-center gap-10">
        <DriverStats />
        <CarSpecification />
      </div>

      <p className="font-mono text-xs tracking-[0.2em] text-smoke uppercase">Press W to go</p>
    </div>
  )
}
