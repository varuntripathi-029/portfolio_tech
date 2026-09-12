import type { ProjectStatus } from '../ui/StatusChip'

/**
 * Real portfolio content for PROJECTS, ACHIEVEMENTS and EXPERIENCE, resolved
 * from `about_tech.md` / `about_product.md` against every override in spec
 * section 14 (the repo count, the Zerodha date and venue, the crowd figure,
 * the pivot dating). Do not retype these from memory elsewhere: import from
 * here.
 */

export type ProjectId =
  | 'hiresignal'
  | 'urbanair'
  | 'legal'
  | 'mxrating'
  | 'synapsescan'
  | 'devagent'
  | 'crime'
  | 'social'
  | 'javalogs'

export interface ProjectItem {
  id: ProjectId
  title: string
  timeline: string
  status: NonNullable<ProjectStatus>
  /** One line, per spec 3.3: a card that satisfies the reader means nobody drives. */
  oneLine: string
  stack: string[]
  liveUrl: string | null
  repoUrl: string
  visualKind: 'screenshot' | 'phone' | 'diagram' | 'terminal'
  /** Present only on the Legal Contract Analyzer: the one card carrying the pivot. */
  pivot?: { ttft: string; retrieval: string }
  secondaryLink?: { label: string; url: string }
  /** Fired at low priority when the PROJECTS card opens, per spec 14 Q8. */
  warmupUrls?: string[]
}

// Strongest first. This order is the deliverable, not a date sort.
export const PROJECTS: ProjectItem[] = [
  {
    id: 'hiresignal',
    title: 'HireSignal',
    timeline: 'Aug 2026 to present',
    status: 'LIVE',
    oneLine: 'AI hiring intelligence platform crawling 886+ sources to score company hiring momentum.',
    stack: ['FastAPI', 'PostgreSQL + pgvector', 'Celery', 'Redis', 'Groq', 'React 19'],
    liveUrl: 'https://get-job-fe.vercel.app/',
    repoUrl: 'https://github.com/varuntripathi-029/get_job_be',
    visualKind: 'screenshot',
  },
  {
    id: 'urbanair',
    title: 'UrbanAir Intel',
    timeline: 'Jul 2026 to Aug 2026',
    status: 'LIVE',
    oneLine: '1km gridded air quality digital twin for Delhi NCR, forecasting PM2.5 with a ConvLSTM.',
    stack: ['PyTorch', 'PostGIS', 'LangGraph', 'Groq', 'Next.js 14'],
    liveUrl: 'https://eta-liard-nine.vercel.app/',
    repoUrl: 'https://github.com/varuntripathi-029/ETA',
    visualKind: 'screenshot',
  },
  {
    id: 'legal',
    title: 'Legal Contract Analyzer',
    timeline: 'Feb 2026 to Mar 2026',
    status: 'LIVE',
    oneLine: 'RAG over Indian employment law, streamed from Groq with sub-second first tokens.',
    stack: ['FastAPI', 'FAISS', 'Groq', 'PaddleOCR', 'Redis'],
    liveUrl: 'https://legal-rag-frontend-silk.vercel.app/',
    repoUrl: 'https://github.com/varuntripathi-029/legal_clause_analyzer-be',
    visualKind: 'screenshot',
    pivot: { ttft: '26.7s to 0.2s', retrieval: '40x faster, to 10ms' },
    // Backend /docs is intentionally not linked (spec 14 Q8): a free HF Space
    // that cold-starts, measured at a 25s timeout on first hit. Warmed
    // instead, silently, when this card opens.
    warmupUrls: ['https://babemario-legal-clause-be.hf.space/'],
  },
  {
    id: 'mxrating',
    title: 'MX_rating',
    timeline: 'Jun 2026 to Jul 2026',
    status: 'LIVE',
    oneLine: 'Deterministic AI agent-readiness scoring engine, crawled and rule-scored, not model-scored.',
    stack: ['FastAPI', 'Playwright', 'SQLAlchemy 2.0 async', 'Groq', 'Next.js 16'],
    liveUrl: 'https://ma-frontend-seven.vercel.app/',
    repoUrl: 'https://github.com/varuntripathi-029/MA_backend',
    visualKind: 'screenshot',
    secondaryLink: { label: 'Why We Built It, the blog', url: 'https://mx-blog-psi.vercel.app/' },
  },
  {
    id: 'synapsescan',
    title: 'SynapseScan',
    timeline: 'Aug 2026',
    status: 'LIVE',
    oneLine: 'Tech-debt and code-quality intelligence over ingested repos, with a RAG chatbot on the codebase.',
    stack: ['Next.js 14', 'React 18', 'PostgreSQL 15', 'tree-sitter'],
    liveUrl: 'https://synapse-scan-kappa.vercel.app/',
    repoUrl: 'https://github.com/varuntripathi-029/SynapseScan',
    visualKind: 'screenshot',
  },
  {
    id: 'devagent',
    title: 'DevAgent Remote',
    timeline: 'Jul 2026',
    status: 'MOBILE',
    oneLine: 'Mobile control plane for CLI coding agents, tunnelled over an outbound WebSocket with 0 inbound ports.',
    stack: ['FastAPI', 'asyncio', 'Expo React Native', 'GitHub OAuth'],
    liveUrl: null,
    repoUrl: 'https://github.com/varuntripathi-029/remote-agent',
    visualKind: 'phone',
  },
  {
    id: 'crime',
    title: 'Crime Intelligence Platform',
    timeline: 'Jul 2026',
    status: 'ARCHIVED',
    oneLine: '10-microservice crime analytics platform on real NCRB district-wise IPC data.',
    stack: ['FastAPI x10', 'SHAP', 'NetworkX', 'React 19', 'D3'],
    liveUrl: null,
    repoUrl: 'https://github.com/varuntripathi-029/crime-intelligence-platform',
    visualKind: 'diagram',
  },
  {
    id: 'social',
    title: 'Social Media Platform',
    timeline: 'Nov 2025 to Feb 2026',
    status: 'LIVE',
    oneLine: 'Java and Spring Boot social platform, 50 endpoints, a Redis cache-aside layer cutting DB reads 95%.',
    stack: ['Spring Boot 3', 'Spring Security', 'PostgreSQL', 'Redis', 'React 19'],
    liveUrl: 'https://socialmedia-fe-beta.vercel.app',
    repoUrl: 'https://github.com/varuntripathi-029/socialmedia_be',
    visualKind: 'screenshot',
  },
  {
    id: 'javalogs',
    title: 'Java Streaming Log Analyzer',
    timeline: 'Mar 2026 to Apr 2026',
    status: 'BACKEND',
    oneLine: 'Zero-dependency streaming engine, a 12-thread pool processing 100k logs/sec with sliding-window anomaly detection.',
    stack: ['Java 21', 'ConcurrentHashMap', 'LongAdder'],
    liveUrl: null,
    repoUrl: 'https://github.com/varuntripathi-029/java_logs_analyzer',
    visualKind: 'terminal',
  },
]

export function projectById(id: ProjectId): ProjectItem {
  const found = PROJECTS.find((p) => p.id === id)
  if (!found) throw new Error(`content: no project "${id}"`)
  return found
}

export interface AchievementItem {
  id: string
  title: string
  result: string
  date: string
  description: string
  repoUrl?: string
  /** Set on items 2, 3 and 4 (spec 14 Q7): these link to their PROJECTS card. */
  linkedProject?: ProjectId
  verifyUrl?: string
}

export const ACHIEVEMENTS: AchievementItem[] = [
  {
    id: 'redrob',
    title: 'Redrob AI',
    result: 'Finalist',
    date: 'Jun 2026',
    description:
      '4-stage candidate ranking pipeline processing 100K resumes in under 45 seconds on CPU.',
    // Achievement row only, per spec 14 Q7: its own repo link, no PROJECTS card.
    repoUrl: 'https://github.com/varuntripathi-029/Secret_saucers',
  },
  {
    id: 'et-ai',
    title: 'ET AI Hackathon',
    result: 'Finalist',
    date: 'Jul 2026 to Aug 2026',
    description: 'UrbanAir Intel, a 1km gridded air quality platform for Delhi NCR.',
    linkedProject: 'urbanair',
  },
  {
    id: 'zoho',
    title: 'Zoho Catalyst Hackathon',
    result: '3rd Runner Up',
    date: 'Jul 2026',
    description:
      'Crime Intelligence Platform, 10 microservices on real NCRB data with forecasting, network analysis and explainable AI.',
    linkedProject: 'crime',
  },
  {
    id: 'latentcode',
    title: 'LatentCode Hackathon',
    result: 'Finalist',
    date: 'Aug 2026',
    description: 'SynapseScan, tech-debt intelligence with RAG-based code analysis and CI/CD webhooks.',
    linkedProject: 'synapsescan',
  },
  {
    id: 'maximise',
    title: 'Maximise',
    result: '1st Place',
    date: 'E-Summit 2026',
    description: 'Highest ROI on a INR 10,00,000 virtual portfolio over a 10 day stock trading simulation.',
  },
  {
    id: 'ad-mads',
    title: 'Ad Mads',
    result: '1st Rank',
    date: 'Abhivyakti 2026',
    description: 'Nationwide creative campaign competition.',
  },
  {
    id: 'leetcode',
    title: 'LeetCode Knight',
    result: 'Rating 1886',
    date: '',
    description: '300+ problems solved.',
  },
  {
    id: 'genai-cert',
    title: 'GenAI Certification',
    result: 'Complete',
    date: 'Udemy, Jan 2026',
    description:
      'Complete Guide to Building, Deploying and Optimizing Generative AI with LangChain and HuggingFace. Credential UC-8e660c0d-23ab-4c26-8e3e-0adccba6cc4c.',
    verifyUrl: 'https://www.udemy.com/certificate/UC-8e660c0d-23ab-4c26-8e3e-0adccba6cc4c/',
  },
]

export interface ExperienceItem {
  id: string
  role: string
  org: string
  mode: string
  timeline: string
  bullets: string[]
  /** Only the Zerodha entry carries this: the source date/venue was wrong. */
  correction?: string
}

// Most relevant first, per spec 3.5, not chronological. The two TantraFiesta
// 2025 roles sit next to each other: spec 14 Q3b is now fully resolved, the
// Marketing Lead role was the Oct 2025 edition, the same fest as the Zerodha
// programme below it, not the Aug-Oct 2024 edition about_product.md names.
// In 2024 the only role held was E-Cell.
export const EXPERIENCE: ExperienceItem[] = [
  {
    id: 'ideal-fitness',
    role: 'AI Automation Intern',
    org: 'Ideal Fitness Centre',
    mode: 'Freelance, on-site',
    timeline: 'Dec 2024 to Jan 2025',
    bullets: [
      'Chained Claude, ElevenLabs and HeyGen inside an n8n pipeline into a single content workflow spanning script, voice and video, cutting manual production effort by roughly 50%.',
      'Set trigger conditions, fallback paths and a review gate so non-technical staff could run it unattended.',
    ],
  },
  {
    id: 'tantrafiesta',
    role: 'Marketing Lead',
    org: 'TantraFiesta 2025',
    mode: 'Student leadership',
    timeline: 'Aug 2025 to Oct 2025',
    bullets: [
      'Grew registered participants 16.7% year on year to 1,400+ and drew a 5,000+ crowd.',
      'Ran retargeting campaigns on measured response rather than reach.',
    ],
    correction: 'The 2025 edition, not Aug to Oct 2024 as about_product.md has it.',
  },
  {
    id: 'zerodha',
    role: 'Campus Student Leader',
    org: 'Zerodha Under 25',
    mode: 'Campus programme',
    timeline: 'Oct 2025',
    bullets: [
      'Ran the Under 25 campus-artist programme at IIIT Nagpur, booking 4 headline acts at TantraFiesta 2025: Luv Juyal, Somesh Sharma, Bhagyashree Thakkar, Smera Shetty.',
      'Owned outreach, negotiation and on-ground delivery, drawing 1M+ online impressions.',
    ],
    correction: 'At TantraFiesta 2025, not Abhivyakti 2026.',
  },
  {
    id: 'e-cell',
    role: 'Lead',
    org: 'E-Cell, IIIT Nagpur',
    mode: 'Student leadership',
    timeline: 'Aug 2023 to Apr 2025',
    bullets: [
      'Closed INR 11,00,000+ across 10+ technology sponsors, running the pipeline from cold outreach to signature.',
      'Directed 20+ volunteers to stage 17 entrepreneurship events drawing 2,500+ attendees.',
    ],
  },
]

export interface RoleRow {
  role: string
  backedBy: string
}

// Ordered by preference, AI/ML first, per spec 1.9.
export const ROLES: RoleRow[] = [
  { role: 'AI / ML Engineer', backedBy: 'RAG pipelines, LangGraph agents, ConvLSTM forecasting, LLM eval harnesses' },
  { role: 'Backend Engineer, Python', backedBy: 'FastAPI, Celery, PostgreSQL and pgvector, async SQLAlchemy' },
  { role: 'Backend Engineer, Java', backedBy: 'Spring Boot 3, JPA, Redis, 50-endpoint production service' },
  { role: 'Full Stack Engineer', backedBy: 'React 19, Next.js and TypeScript front ends over his own APIs' },
  { role: 'SDE, New Grad', backedBy: 'LeetCode Knight 1886, 300+ problems, 40+ public repos' },
]

export const CONTACT_LINKS = {
  linkedin: 'https://www.linkedin.com/in/varun-tripathi-bb338a295/',
  github: 'https://github.com/varuntripathi-029',
  email: 'varun.tripathi2004@gmail.com',
  phone: '+919569680578',
  phoneDisplay: '+91 95696 80578',
}

export const CREDITS = [
  { work: 'RC-12 race car model', author: 'Dahie', license: 'CC-BY' },
  { work: 'City skyline model', author: '99.Miles', license: 'CC-BY' },
]
