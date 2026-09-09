import { TIMELINE } from '../data/timeline'
import type { JumpTarget } from '../state/raceStore'

/**
 * The navbar is a shortcut layer over the chronology, not a re-sectioning of
 * it. There is no "Projects section" on the track: there are nine projects
 * scattered across four years, and several of them share a single stop
 * because the timeline folded them into one event (the June hackathon treble,
 * and the July UrbanAir / Crime / DevAgent cluster).
 *
 * So rows are named jump targets, and more than one row may resolve to the
 * same trackZ. Splitting the timeline to give every row its own stop would
 * change the drive, which is out of scope for a navigation layer.
 */

export interface NavRow {
  /** Mono timing column on the left of the dropdown row. */
  year: string
  label: string
  /** One line. Deliberately not the card content: if the dropdown satisfies
   * the reader, nobody drives and the 3D becomes decoration. */
  note: string
  target: JumpTarget
}

export interface NavGroup {
  id: string
  label: string
  rows: NavRow[]
}

/** Resolves a timeline id to a jump target, failing loudly on a typo. */
function at(id: string): JumpTarget {
  const index = TIMELINE.findIndex((e) => e.id === id)
  if (index === -1) throw new Error(`navData: no timeline event with id "${id}"`)
  return { kind: 'event', index }
}

const PROJECTS: NavRow[] = [
  {
    year: 'Nov 2025',
    label: 'Social Media Platform',
    note: 'Spring Boot, 50 endpoints, Redis cache-aside cut DB reads 95 percent.',
    target: at('social-media-platform'),
  },
  {
    year: 'Feb 2026',
    label: 'Legal Contract Analyzer',
    note: 'RAG over Indian employment law. Time to first token 26.7s to 0.2s.',
    target: at('legal-rag-pivot'),
  },
  {
    year: 'Mar 2026',
    label: 'Java Streaming Log Analyzer',
    note: 'Zero dependencies, 12 threads, 100,000 logs per second.',
    target: at('java-log-analyzer'),
  },
  {
    year: 'Jun 2026',
    label: 'MX_rating',
    note: 'AI agent-readiness scoring. Deterministic rules, the model only narrates.',
    target: at('mx-rating'),
  },
  {
    year: 'Jul 2026',
    label: 'UrbanAir Intel',
    note: '1km gridded air quality twin for Delhi NCR. Beat persistence by 7.3 percent.',
    target: at('urbanair-cluster'),
  },
  {
    year: 'Jul 2026',
    label: 'Crime Intelligence Platform',
    note: 'Ten FastAPI microservices over real NCRB data. Deployment since closed.',
    target: at('urbanair-cluster'),
  },
  {
    year: 'Jul 2026',
    label: 'DevAgent Remote',
    note: 'Drive CLI coding agents from a phone. 4,508 lines in 10 days.',
    target: at('urbanair-cluster'),
  },
  {
    year: 'Aug 2026',
    label: 'SynapseScan',
    note: 'Tech-debt intelligence. Tree-sitter AST parsing plus a RAG chatbot over code.',
    target: at('synapsescan'),
  },
  {
    year: 'Aug 2026',
    label: 'HireSignal',
    note: 'In production. 886 sources crawled, 48 endpoints, 319 tests.',
    target: at('hiresignal'),
  },
]

const HACKATHONS: NavRow[] = [
  {
    year: 'Jun 2026',
    label: 'Redrob AI, Finalist',
    note: '100,000 resumes ranked in under 45 seconds on CPU.',
    target: at('hackathon-treble'),
  },
  {
    year: 'Jul 2026',
    label: 'ET AI Hackathon, Finalist',
    note: 'UrbanAir Intel. ConvLSTM forecasting with LangGraph source attribution.',
    target: at('urbanair-cluster'),
  },
  {
    year: 'Jul 2026',
    label: 'Zoho Catalyst, 3rd Runner Up',
    note: 'Crime Intelligence Platform. Forecasting, network analysis, SHAP.',
    target: at('urbanair-cluster'),
  },
  {
    year: 'Aug 2026',
    label: 'LatentCode, Finalist',
    note: 'SynapseScan. Repo ingestion, duplication detection, CI/CD webhooks.',
    target: at('synapsescan'),
  },
]

const EXPERIENCE: NavRow[] = [
  {
    year: 'Aug 2023',
    label: 'E-Cell Lead',
    note: 'First leadership post, running entrepreneurship initiatives on campus.',
    target: at('ecell-lead'),
  },
  {
    year: 'Aug 2024',
    label: 'TantraFiesta Marketing Lead',
    note: 'Marketing for the campus tech festival.',
    target: at('tantrafiesta'),
  },
  {
    year: 'Dec 2024',
    label: 'Ideal Fitness Centre',
    note: 'AI automation intern. Where the Java to AI pivot actually started.',
    target: at('ideal-fitness'),
  },
  {
    year: 'Jul 2026',
    label: 'Zerodha Under 25 Campus Leader',
    note: 'Campus leader for the Under 25 community.',
    target: at('zerodha-leader'),
  },
]

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'driver',
    label: 'Driver',
    rows: [
      {
        year: 'Grid',
        label: 'Driver Profile',
        note: 'Stats, and the full stack sheet. Back to the starting grid.',
        target: { kind: 'grid' },
      },
    ],
  },
  { id: 'projects', label: 'Projects', rows: PROJECTS },
  { id: 'hackathons', label: 'Hackathons', rows: HACKATHONS },
  { id: 'experience', label: 'Experience', rows: EXPERIENCE },
  {
    id: 'hire',
    label: 'Hire',
    rows: [
      {
        year: 'Now',
        label: 'Open to Roles',
        note: 'AI/ML, backend in Python or Java, full stack, new grad SDE. And contact.',
        target: { kind: 'end' },
      },
    ],
  },
]
