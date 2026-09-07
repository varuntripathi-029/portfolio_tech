// Roles table copied verbatim from the spec, AI/ML first. "Open to", never
// "looking for". Short title plus at most one supporting clause each.
const ROLES = [
  { title: 'AI / ML Engineer', backedBy: 'RAG pipelines, LangGraph agents, ConvLSTM forecasting, LLM eval harnesses' },
  { title: 'Backend Engineer, Python', backedBy: 'FastAPI, Celery, PostgreSQL/pgvector, async SQLAlchemy' },
  { title: 'Backend Engineer, Java', backedBy: 'Spring Boot 3, JPA, Redis, 50 endpoint production service' },
  { title: 'Full Stack Engineer', backedBy: 'React 19, Next.js, TypeScript front ends over his own APIs' },
  { title: 'SDE, New Grad', backedBy: 'LeetCode Knight 1886, 300+ problems, 30+ public repos' },
]

/**
 * No checkered flag, no finish gantry. This card is the ask, not a trophy.
 * Loop prompt text is exact per spec: PRESS W FOR ANOTHER LAP.
 */
export function EndScreen() {
  return (
    <div className="fixed top-1/2 right-8 z-20 w-[440px] -translate-y-1/2">
      <div className="chamfer border-2 border-race-red bg-graphite p-7">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-race-red">Fuel Low: Race Incomplete</p>
        <h1 className="mt-2 text-2xl leading-snug font-black tracking-tight text-paper uppercase">
          Give me an internship to fuel my car and finish the race.
        </h1>

        <p className="mt-5 font-mono text-xs uppercase tracking-widest text-smoke">Open to Roles Like</p>
        <ul className="mt-2 space-y-2">
          {ROLES.map((r) => (
            <li key={r.title}>
              <p className="text-sm font-semibold text-paper">{r.title}</p>
              <p className="text-xs text-smoke">{r.backedBy}</p>
            </li>
          ))}
        </ul>

        <div className="mt-5 space-y-1 border-t border-slate pt-4 font-mono text-xs text-smoke">
          <p>varun.tripathi2004@gmail.com</p>
          <p>+91-9569680578</p>
          <div className="mt-1 flex gap-4">
            <a
              href="https://github.com/varuntripathi-029"
              target="_blank"
              rel="noopener noreferrer"
              className="text-paper hover:text-race-red"
            >
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/varun-tripathi-bb338a295/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-paper hover:text-race-red"
            >
              LinkedIn
            </a>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-slate">SI RaceCar RC-12 by Dahie, Sketchfab, CC-BY.</p>

        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-smoke">
          Press W for another lap
        </p>
      </div>
    </div>
  )
}
