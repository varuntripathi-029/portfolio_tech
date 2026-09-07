// DRAFT COPY. All oneLiner/bullets text here is a first pass compressed from
// about_tech.md for the owner to rewrite. Not final.
//
// trackZ: 14 events spaced evenly from 200 to 2200 (~154m apart). liveUrl,
// repoUrl and status are taken verbatim from the spec's per-project link
// table; nothing is invented. screenshot is null everywhere, those assets
// do not exist yet (see spec: cards must render correctly with a
// placeholder).

export type EventKind = 'project' | 'experience' | 'pivot'
export type ProjectStatus = 'LIVE' | 'ARCHIVED' | 'BACKEND' | 'MOBILE' | null

export interface TimelineEvent {
  id: string
  year: number
  dateLabel: string
  title: string
  kind: EventKind
  trackZ: number
  oneLiner: string
  bullets: string[]
  tech: string[]
  liveUrl: string | null
  repoUrl: string | null
  status: ProjectStatus
  screenshot: string | null
}

export const TIMELINE: TimelineEvent[] = [
  {
    id: 'btech-start',
    year: 2023,
    dateLabel: '2023',
    title: 'B.Tech Begins at IIIT Nagpur',
    kind: 'experience',
    trackZ: 200,
    oneLiner:
      'Started B.Tech in Electronics and Communication Engineering (IoT Specialisation), IIIT Nagpur.',
    bullets: ['Four year program, class of 2027.', 'The starting grid for everything that follows.'],
    tech: [],
    liveUrl: null,
    repoUrl: null,
    status: null,
    screenshot: null,
  },
  {
    id: 'ecell-lead',
    year: 2023,
    dateLabel: 'Aug 2023',
    title: 'E-Cell Lead',
    kind: 'experience',
    trackZ: 354,
    oneLiner: 'Took on the E-Cell Lead role, running entrepreneurship initiatives on campus.',
    bullets: ['First leadership post, early proof of ownership beyond coursework.'],
    tech: [],
    liveUrl: null,
    repoUrl: null,
    status: null,
    screenshot: null,
  },
  {
    id: 'tantrafiesta',
    year: 2024,
    dateLabel: 'Aug to Oct 2024',
    title: 'TantraFiesta Marketing Lead',
    kind: 'experience',
    trackZ: 508,
    oneLiner: 'Led marketing for TantraFiesta, the college technical fest.',
    bullets: ['Coordinated outreach and campaign planning across the event window.'],
    tech: [],
    liveUrl: null,
    repoUrl: null,
    status: null,
    screenshot: null,
  },
  {
    id: 'ideal-fitness',
    year: 2025,
    dateLabel: 'Dec 2024 to Jan 2025',
    title: 'Ideal Fitness Centre, AI Automation Intern',
    kind: 'experience',
    trackZ: 662,
    oneLiner: 'Chained Claude, ElevenLabs and HeyGen inside n8n to automate content production.',
    bullets: [
      'First time seeing AI actually replace manual work.',
      'The spark that started the Java to AI pivot.',
    ],
    tech: ['n8n', 'Claude', 'ElevenLabs', 'HeyGen'],
    liveUrl: null,
    repoUrl: null,
    status: null,
    screenshot: null,
  },
  {
    id: 'genai-cert',
    year: 2026,
    dateLabel: 'Jan 2026',
    title: 'GenAI Certification, LangChain and HuggingFace',
    kind: 'experience',
    trackZ: 815,
    oneLiner: 'Completed a certification on building, deploying and optimising Generative AI.',
    bullets: ['Covered RAG, LangChain and HuggingFace end to end.'],
    tech: ['LangChain', 'HuggingFace'],
    liveUrl: null,
    repoUrl: null,
    status: null,
    screenshot: null,
  },
  {
    id: 'social-media-platform',
    year: 2026,
    dateLabel: 'Nov 2025 to Feb 2026',
    title: 'Scalable Social Media Platform',
    kind: 'project',
    trackZ: 969,
    oneLiner:
      'Full featured social platform on Java and Spring Boot: posts, follow graph, events with RSVPs.',
    bullets: [
      '50 REST endpoints, 14 JPA entities, 29 backend tests.',
      'Redis cache aside layer cut DB reads by up to 95 percent.',
      'Patched IDOR and IP spoofing, added a Redis backed rate limiter.',
    ],
    tech: ['Java 21', 'Spring Boot', 'PostgreSQL', 'Redis', 'React 19'],
    liveUrl: 'https://socialmedia-fe-beta.vercel.app',
    repoUrl: 'https://github.com/varuntripathi-029/socialmedia_be',
    status: 'LIVE',
    screenshot: null,
  },
  {
    id: 'legal-rag-pivot',
    year: 2026,
    dateLabel: 'Feb to Mar 2026',
    title: 'Legal Contract Analyzer: the Pivot',
    kind: 'pivot',
    trackZ: 1123,
    oneLiner: 'Box box, switching to Plan B. Java to Python, REST to RAG.',
    bullets: [
      'RAG system analysing Indian employment contracts against constitutional law.',
      'Slashed time to first token from 26.7s to 0.2s with Groq and SSE streaming.',
      'FAISS retrieval accelerated 40x using local CPU embeddings.',
    ],
    tech: ['Python', 'FastAPI', 'FAISS', 'Groq', 'PaddleOCR'],
    liveUrl: 'https://legal-rag-frontend-silk.vercel.app',
    repoUrl: 'https://github.com/varuntripathi-029/legal_clause_analyzer-be',
    status: 'LIVE',
    screenshot: null,
  },
  {
    id: 'java-log-analyzer',
    year: 2026,
    dateLabel: 'Mar to Apr 2026',
    title: 'Java Streaming Log Analyzer',
    kind: 'project',
    trackZ: 1277,
    oneLiner: 'Zero dependency log engine processing 100,000 logs per second.',
    bullets: [
      '12 thread pool, 65,536 capacity queue.',
      'Sliding window anomaly detection against a 5 minute baseline.',
    ],
    tech: ['Java 21', 'Maven'],
    liveUrl: null,
    repoUrl: 'https://github.com/varuntripathi-029/java_logs_analyzer',
    status: 'BACKEND',
    screenshot: null,
  },
  {
    id: 'hackathon-treble',
    year: 2026,
    dateLabel: 'Jun 2026',
    title: 'Redrob AI Finalist, Maximise and Ad Mads Wins',
    kind: 'experience',
    trackZ: 1431,
    oneLiner: 'Redrob AI Hackathon Finalist, plus Maximise 1st Place and Ad Mads 1st Rank.',
    bullets: [
      'Redrob: 4 stage candidate ranking pipeline, 100K resumes in under 45 seconds on CPU.',
      'Stage 1 heuristics pruned 96 percent of candidates before any ML ran.',
    ],
    tech: ['PyTorch', 'sentence-transformers', 'FAISS'],
    liveUrl: null,
    repoUrl: 'https://github.com/varuntripathi-029/Secret_saucers',
    status: null,
    screenshot: null,
  },
  {
    id: 'mx-rating',
    year: 2026,
    dateLabel: 'Jun to Jul 2026',
    title: 'MX_rating',
    kind: 'project',
    trackZ: 1585,
    oneLiner: 'SaaS scoring engine for AI agent readiness, the first real product rather than a hackathon build.',
    bullets: [
      '9 stage workflow: Playwright crawl, deterministic rule engine, Groq narration.',
      'Score is fully deterministic. The LLM only narrates, never scores.',
    ],
    tech: ['FastAPI', 'Playwright', 'PostgreSQL', 'Next.js'],
    liveUrl: 'https://ma-frontend-seven.vercel.app',
    repoUrl: 'https://github.com/varuntripathi-029/MA_backend',
    status: 'LIVE',
    screenshot: null,
  },
  {
    id: 'urbanair-cluster',
    year: 2026,
    dateLabel: 'Jul 2026',
    title: 'UrbanAir Intel, Crime Intelligence, DevAgent Remote',
    kind: 'project',
    trackZ: 1738,
    oneLiner: 'UrbanAir Intel, a 1km gridded air quality digital twin for Delhi NCR. ET AI Hackathon Finalist.',
    bullets: [
      'PyTorch ConvLSTM beat the persistence baseline by 7.3 percent.',
      'Same month: Crime Intelligence Platform, Zoho Catalyst 3rd Runner Up.',
      'Same month: DevAgent Remote, mobile control for CLI coding agents.',
    ],
    tech: ['PyTorch', 'LangGraph', 'PostGIS', 'Next.js'],
    liveUrl: 'https://eta-liard-nine.vercel.app',
    repoUrl: 'https://github.com/varuntripathi-029/ETA',
    status: 'LIVE',
    screenshot: null,
  },
  {
    id: 'zerodha-leader',
    year: 2026,
    dateLabel: 'Jul 2026',
    title: 'Zerodha Under 25 Campus Leader',
    kind: 'experience',
    trackZ: 1892,
    oneLiner: 'Selected as Zerodha Under 25 Campus Leader.',
    bullets: ['Campus facing role representing Zerodha to the student community.'],
    tech: [],
    liveUrl: null,
    repoUrl: null,
    status: null,
    screenshot: null,
  },
  {
    id: 'synapsescan',
    year: 2026,
    dateLabel: 'Aug 2026',
    title: 'SynapseScan',
    kind: 'project',
    trackZ: 2046,
    oneLiner: 'Tech debt and code quality intelligence platform. LatentCode Hackathon Finalist.',
    bullets: [
      'RAG chatbot reasoning over code chunks stored as embeddings.',
      'Duplication detection via sliding window MD5 hashing across the codebase.',
    ],
    tech: ['Next.js', 'TypeScript', 'PostgreSQL', 'tree-sitter'],
    liveUrl: 'https://synapse-scan-kappa.vercel.app',
    repoUrl: 'https://github.com/varuntripathi-029/SynapseScan',
    status: 'LIVE',
    screenshot: null,
  },
  {
    id: 'hiresignal',
    year: 2026,
    dateLabel: 'Aug 2026 to Present',
    title: 'HireSignal',
    kind: 'project',
    trackZ: 2200,
    oneLiner: 'AI hiring intelligence platform. The one going to production.',
    bullets: [
      'Crawls 886+ sources, scores hiring momentum with a deterministic function.',
      '48 API endpoints, 9 database tables, 319 tests.',
      'Cut classifier spend 12x while holding 0.96 mean confidence.',
    ],
    tech: ['FastAPI', 'PostgreSQL', 'Celery', 'Groq', 'React 19'],
    liveUrl: 'https://get-job-fe.vercel.app',
    repoUrl: 'https://github.com/varuntripathi-029/get_job_be',
    status: 'LIVE',
    screenshot: null,
  },
]

/** z where the car runs out of fuel and the race ends, unfinished. */
export const FUEL_OUT_Z = 2350
