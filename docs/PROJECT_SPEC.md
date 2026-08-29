# CareerLens AI

## Implementation Status

- ✅ Phase 1 — Project foundation (Next.js, TypeScript, Tailwind, design system)
- ✅ Phase 2 — Interactive landing page
- ✅ Phase 3 — Production-style chat UI (mock responses)
- ✅ Phase 4 — Gemini integration, streaming, CareerLens personality
- ✅ Phase 5 — Supabase Authentication (email/password), PostgreSQL schema
  with Row Level Security, career profile (onboarding + dashboard), and
  authenticated career-profile context feeding the AI.
- ✅ Phase 6 — CV upload (PDF/DOCX) to private Supabase Storage, server-side
  text extraction, combined Gemini parsing + evaluation with an
  explainable deterministic score, resume review UI, and resume context
  feeding the chat AI alongside the career profile.
- ✅ Phase 7 — Sri Lanka-first job discovery via a source-agnostic provider
  architecture (demo/fixture provider active by default — no real search
  API credential configured yet), deterministic weighted job matching
  (skills/role/experience/education/location/keywords, alias-aware skill
  matching, never-zero experience scoring for entry-level candidates),
  `/jobs` search + detail + saved pages, and chat-integrated job search
  (results shown as real interactive cards inline in conversation, not
  just described in prose).
- ✅ Phase 8 — Job-specific CV tailoring, ATS/keyword alignment analysis,
  and tailored cover letter generation. Deterministic (non-Gemini) resume-
  vs-job comparison (`lib/application/compare.ts`) categorizes each
  required skill as a strong match, match, partial (via a small curated
  related-skill map, e.g. Power BI for a Tableau requirement), missing, or
  insufficient evidence, and scores keyword alignment the same way. A
  closed-world `VerifiedFacts` object (`lib/application/verified-facts.ts`),
  built only from the user's own career profile + selected resume, is the
  sole source Gemini may draw from when tailoring a CV or writing a cover
  letter — the prompt explicitly forbids introducing anything outside it.
  Both the tailored CV and the cover letter are versioned (append-only,
  original resume never modified), with a version history UI and a
  browser-print/PDF-friendly layout (`/application/[jobId]`).
- ✅ Phase 9 — Real multi-source job discovery, replacing the demo-only
  default. **ITPro.lk is a genuinely live source** — a public JSON API,
  verified directly by fetching it (no key required for reads). A
  company-careers provider (schema.org JobPosting extraction) is fully
  implemented but has zero pages seeded — two real companies' pages were
  checked and both blocked automated requests (HTTP 403); it's a real,
  working mechanism waiting on a verified page, not a stub. LinkedIn,
  XpressJobs, and ikman.lk are **not** searched automatically — LinkedIn's
  ToS prohibits it and its API isn't self-serve; XpressJobs/ikman have no
  public API or structured data (robots.txt permits crawling for both, but
  guessing undocumented HTML structure was deliberately avoided). All
  three support pasting a job URL (schema.org extraction, same mechanism)
  or a job description directly in chat instead. Cross-source
  deduplication (`jobs.duplicate_of`) links the same real-world vacancy
  found via different sources without ever deleting either row. Ranking
  stays deterministic (match score + a small bounded freshness nudge — see
  `DATABASE.md`/`JOB_DATA.md`); chat shows at most 5 results, only ones
  clearing a quality floor, never padded to hit a round number. Minimal
  application-tracking status (Saved → Preparing → ... → Offer, split
  across `saved_jobs.status` and `application_documents.application_status`
  — see `DATABASE.md` for why two columns, not a new `applications`
  table) was added as a foundation, not a full tracker. Not yet implemented
  as of Phase 9: interview agent, portfolio crawling, a worldwide
  job-search API (architecture ready, no credential configured), automated
  `listing_status` transitions (no provider currently signals closure).
- ✅ Phase 10 — Portfolio Intelligence, GitHub analysis, LinkedIn
  optimization, SEO readiness, and a job-specific Interview Coach —
  transforming CareerLens from "job search + CV tailoring" into a
  cross-domain career-readiness agent. Portfolio (`/portfolio`): fetches a
  given URL (SSRF-guarded, robots.txt-checked, reusing Phase 9's
  `lib/jobs/url-safety.ts` rather than duplicating it), deterministically
  extracts SEO/structural signals, and scores 6 weighted categories
  (career positioning 20%, projects 25%, technical evidence 20%, content
  quality 15%, recruiter readability 10%, SEO 10%) from Gemini findings —
  same base+impact pattern as resume scoring (Phase 6), never a raw
  Gemini number. GitHub (`/github`): reads only public profile + non-fork
  repos via GitHub's official REST API (verified live, 60 req/hr
  unauthenticated), never private data, never scraped. LinkedIn
  (`/linkedin`): analyzes ONLY user-pasted content — no fetching, no
  scraping path exists at all, matching LinkedIn's ToS restriction
  documented in `JOB_DATA.md`. Interview Coach (`/interview`): generates a
  question set grounded in VerifiedFacts (reused directly from Phase 8) +
  an optional selected job, runs one question at a time, and scores each
  answer's "Answer Quality Score" (relevance/structure/clarity/technical
  accuracy/conciseness — deliberately no "confidence" dimension, since
  text alone can't measure that) — explicitly never framed as an interview
  outcome or hiring prediction. Career Dashboard (`/career`) shows a
  deterministic, weighted Career Readiness score (CV 20/Portfolio
  20/Skills 20/Projects 15/LinkedIn 10/GitHub 10/Interview 5%) that
  excludes and renormalizes around un-analyzed components rather than
  scoring them 0, plus a deterministic Next-Best-Action recommendation
  (the analyzed component with the largest weight × gap, with a
  strong-across-the-board fallback to recommending interview practice).
  The job detail page now shows job-specific readiness (reusing the same
  general CV/Portfolio/GitHub scores, but a job-specific Skills score from
  that job's own deterministic match). Not yet implemented: automated
  application tracking beyond the Phase 9 status field, personalized
  learning roadmaps, analytics.
- ✅ Phase 10A — Real job source expansion: **SerpApi Google Jobs**
  implemented as the worldwide/aggregator discovery provider
  (`lib/jobs/providers/serpapi.ts`), verified against SerpApi's own
  documentation (base endpoint, params, `apply_options`/`share_link`
  fields) — but **not live-tested**, since no `SERPAPI_API_KEY` is
  configured in this environment; it correctly reports
  `configuration_required` rather than pretending to work. This is now
  the legitimate path for LinkedIn-origin listings to appear (via Google
  Jobs' own aggregation, never direct scraping) — each carries its real
  apply link and is labeled `sourceType: "aggregator_result"` (MEDIUM
  source confidence, a fixed deterministic label — not a fabricated
  number). Query expansion is deliberately bounded (max 2 variants per
  search) and cached (5 min) to protect against metered-API cost.
  **APYHub was evaluated and found not required** — a real, documented
  visible-text-extraction endpoint exists, but its 5-calls/day free tier
  and lack of structured-metadata output (title/OG/JSON-LD/etc.) mean it
  adds nothing `lib/portfolio/extract.ts` doesn't already do for free.
  **All seven migrations (001-007) have been applied to the live Supabase
  project** — see [`DATABASE.md`](DATABASE.md). No new tables were
  needed: `jobs.duplicate_of` (Phase 9) already models "one vacancy,
  multiple sources."
- ✅ Phase 11 — Advanced Career Intelligence: a real Application Tracking
  pipeline, Skill Gap Intelligence, Personalized Learning Roadmaps, and
  Career Analytics — the "am I actually getting closer to a job?" layer on
  top of Phase 10's readiness snapshot. Application Tracking
  (`/applications`, `/applications/[id]`): an 11-status pipeline (Saved →
  Interested → Preparing → Applied → Screening → Interview → Final Round →
  Offer / Rejected / Withdrawn / Closed) on a genuinely new `applications`
  table (not a further extension of `application_documents` — its
  `source_resume_id` is `NOT NULL` and can't represent pre-tailoring
  states — see `DATABASE.md`), with an append-only
  `application_status_history` (no client update/delete policy at all,
  same pattern as `resume_versions`), follow-up dates, notes, and a link to
  which CV/cover-letter version was actually used once tailoring has
  happened. Skill Gap Intelligence (`/career/skills`): market skill demand
  computed entirely from real, stored `job_skills` rows for jobs matching
  the user's target role (`lib/career/market-skills.ts`) — never an
  invented percentage — classified into strong/developing/missing/emerging
  against the candidate's own skills, then prioritized
  (`lib/career/skill-gap-priority.ts`, high/medium/low by real demand %).
  Learning Roadmap (`/career/roadmap`): step order and content are built
  entirely deterministically (`lib/learning/build-plan.ts`) from that same
  priority list; resource URLs come only from a small, hand-curated,
  individually live-verified catalog (`lib/learning/resource-catalog.ts`)
  — Gemini narrates the plan in 3-5 sentences but never chooses a step,
  order, or URL, so a hallucinated course link is structurally impossible.
  Career Readiness gained an 8th component, "Applications" (weight 8%,
  the other seven rebalanced proportionally down from Phase 10's weights),
  computed from real response-rate data and null (not 0) with zero
  submitted applications. Career Analytics (`/analytics`): interview rate,
  offer rate, response rate, average match score, top applied role, and
  top skill gap, all plain SQL/TypeScript math
  (`lib/applications/stats.ts`, `analytics-summary.ts`) — every rate is
  null, never `NaN`/`Infinity`, when its denominator is genuinely zero.
  Resume Performance groups by the ORIGINAL uploaded resume (Phase 6), not
  the per-job tailored version number (which restarts at 1 for every job
  and wouldn't be comparable across jobs) — and only states an "observed
  association, not causation" once at least two resumes each have 3+
  applications. An interview is only counted as "reached" by checking
  status HISTORY for a genuine `interview` transition, not current status
  alone — a rejection can happen at any stage, so current status alone
  can't tell you whether an interview was ever reached. The chat agent
  gained an `APPLICATIONS CONTEXT` block so it can answer "how are my
  applications going?" / "why am I not getting interviews?" with the
  user's real numbers, or say "I don't have enough application history
  yet" rather than guess. Not yet implemented: push/email notifications,
  drag-and-drop kanban (a simple status `<select>` was used deliberately,
  per spec), automatic application submission.
- ✅ Phase 12 — Notifications & Reminders. A new `notifications` table
  (migration 009) plus `applications.interview_at` (a real scheduled
  interview date/time, distinct from Phase 10's mock `interview_sessions`)
  power five notification types: follow-up, interview (24h + 1h before),
  application deadline, status-change, and a reserved action-required
  type. Everything is deterministic and idempotent by construction —
  `lib/notifications/compute-reminders.ts` derives each reminder's
  `scheduled_for` as a fixed offset from its source date (never Gemini,
  never random), so re-running the reconciliation logic
  (`lib/notifications/sync.ts`) for the same dates always produces the
  same rows, backstopped by real database UNIQUE constraints — a
  status-change notification is 1:1 with the `application_status_history`
  row that caused it, and a scheduled reminder is 1:1 with
  `(application, type, scheduled_for)`. Deadline reminders read
  `jobs.expires_at` only — since no provider currently populates that
  column, this type is implemented correctly but produces nothing yet
  (never a fabricated deadline). The chatbot can set a real reminder
  ("remind me to follow up with WSO2 next Monday", "interview eka Friday
  10am") via a small Gemini call that only extracts/normalizes intent —
  `lib/notifications/parse-datetime.ts` (deterministic, Asia/Colombo-
  anchored, hardcoded UTC+5:30 since Sri Lanka has no DST) is the only
  thing that ever computes an actual timestamp; when the application or
  date is ambiguous, the model asks a clarifying question instead of
  guessing. A `/notifications` center, a bell with an unread badge on
  `/career` and `/applications`, and a simple "Upcoming" list (not a
  calendar) round out the UI. There is no background worker, cron, or
  email/push in this deployment (explicitly out of scope per spec) — a
  scheduled reminder becomes visible the next time the signed-in user
  loads a notifications-reading page at or after its scheduled time; see
  `AI_AGENT.md` for the full delivery-architecture reasoning and what a
  production extension would still require.
- ✅ UX Refactor — chat-first onboarding + real chat persistence. New
  signups/logins land in `/chat`, not the 7-step wizard (which stays
  fully available, reachable from `/profile`, never removed). Fixed a
  real out-of-order-async-response race condition (not a server bug —
  `updateCareerPreferences` always succeeded; a *stale* response could
  overwrite a *newer* one's success/error state on rapid consecutive
  saves) via `lib/utils/request-guard.ts`, a small token-based "ignore
  superseded responses" utility. `conversations`/`messages` tables
  (migration 010) back real chat history for the first time — every turn
  is persisted server-side inside `/api/chat` itself (the user's message
  before Gemini is even called, so it's never lost on failure; the
  assistant's reply, even partial if interrupted), with `/chat/[id]`
  routes, working sidebar rename/delete (with confirmation), and
  recency-grouped conversation history — replacing a sidebar that had
  been 100% hardcoded fake data since Phase 3.
- ✅ Phase 21 — Conversational Job Refinement + Stateful Career Agent. A
  structured `CareerAgentState` (target role, seniority, locations, work
  modes, exclusions, the real IDs of the last shown results, selected
  job) persisted per-conversation (`conversations.agent_state`, migration
  011) replaces the old one-shot, memoryless job-search intent extraction
  — a pure refinement message like "international company ekak nam
  hodai" has no job-search keyword in it at all, so the old keyword gate
  would never even fire. One small structured Gemini call per relevant
  turn extracts ONLY what changed (deciding add-vs-replace semantics
  itself, e.g. "actually hybrid is okay" adds to `workModes`, "anywhere
  in Sri Lanka" replaces a specific `locations` constraint — reasoning a
  mechanical merge can't do); a deterministic merge then applies it
  as-is. References ("second eka gana kiyanna") resolve against real
  stored job IDs, never Gemini's memory — a hallucinated ID is
  structurally impossible. The EXISTING discovery/matching pipeline is
  reused entirely unchanged; state only builds its `JobSearchQuery` and
  applies honest, real-field-only deterministic filters afterward
  (company-type/industry/technology preferences fold into keyword
  augmentation, since no job source provides a structured field to
  filter on precisely — documented rather than faked). Selected-job
  detail questions ("am I qualified?", "how do I apply?") are grounded in
  that job's real, freshly-refetched data. No LangChain/LangGraph — the
  whole pipeline is one Gemini call plus a handful of small, individually
  tested, pure TypeScript functions.
- ✅ WSO2 API Manager Integration — a versioned, non-streaming REST API
  (`/api/v1`, 22 route files / 27 documented paths) meant to sit behind
  WSO2 as an API management/security layer, deliberately separate from
  the existing streaming, cookie-authenticated `/api/chat`. Two
  authentication layers, never conflated: WSO2 authenticates the API
  *consumer* (an application, via OAuth2), while this backend
  independently requires a genuine Supabase user access token as a
  bearer header for every endpoint except the public `GET /health` — the
  same Supabase Auth system the browser app already uses, never a new
  identity system, and never a client-supplied `profile_id`/`user_id`.
  Read endpoints reuse the existing data-fetching functions directly;
  write endpoints could not directly call the existing cookie-based
  Server Actions (those derive their user from Next.js's request-scoped
  cookie jar, unavailable to a bearer-token caller), so each was
  refactored into a thin cookie-based wrapper plus an exported
  `*Core(userId, supabase, ...)` function — the web app's behavior is
  unchanged, and the API calls the exact same business logic (Gemini
  prompts, VerifiedFacts grounding, deterministic matching/comparison,
  notification side effects) rather than duplicating any of it. The match
  score remains fully deterministic (`POST /jobs/match` — the client can
  never submit one). One new, narrow Gemini call
  (`POST /ai/career-analysis`) never invents a qualification. **No new
  migration was needed.** WSO2 API Manager itself was not installed or
  run in this environment — only the backend it points at is
  live-verified; see [`WSO2_API.md`](WSO2_API.md) for the full
  architecture, the honest live-testing status, and the manual
  verification checklist.

See [`ARCHITECTURE.md`](ARCHITECTURE.md), [`DATABASE.md`](DATABASE.md),
[`AI_AGENT.md`](AI_AGENT.md), [`JOB_DATA.md`](JOB_DATA.md), and
[`WSO2_API.md`](WSO2_API.md) for details.

The sections below are the original product specification and describe the
full intended product — not everything in them is built yet.

## 1. Project Overview

CareerLens AI is a friendly AI-powered career assistant designed primarily for Sri Lankan undergraduates, fresh graduates, and entry-level job seekers.

The system helps users discover relevant internships and jobs, understand their suitability for a vacancy, improve their CV and portfolio, create/refine cover letters, and prepare for interviews.

The main interaction model is conversational rather than form-heavy.

Users can communicate naturally using:

* English
* Sinhala
* Singlish
* Mixed Sinhala/English
* Informal conversational language

Example:

> "machan mata data analyst internship ekak oni Colombo wala"

The AI should understand the intent and continue the conversation naturally.

---

## 2. Product Personality

CareerLens should feel like a knowledgeable, supportive Sri Lankan career friend.

The conversational AI should be:

* Friendly
* Informal
* Helpful
* Encouraging
* Honest
* Non-judgmental
* Conversational
* Context-aware

The AI may naturally use casual expressions such as:

* "Ado"
* "machan"
* "hari"
* "ela"
* "patta"
* "balamu"
* "dapan"
* "set wenawa"

However, it must not overuse slang or emojis.

The AI should adapt to the user's language style.

If the user speaks formal English, respond professionally.

If the user speaks Singlish, respond naturally in Singlish.

If the user speaks Sinhala, respond naturally in Sinhala.

If the user requests professional output, generated CVs, cover letters, LinkedIn content, and application materials must use professional language even if the conversation itself is informal.

---

## 3. Core Principle

CareerLens is not simply a resume generator or job search website.

Its main purpose is:

> Understand the candidate → understand available opportunities → determine suitability → explain the match → identify gaps → improve the application → prepare the candidate for the interview.

The system must prioritize truthful representation.

The AI must never invent:

* Qualifications
* Skills
* Work experience
* Certifications
* Projects
* Achievements
* Job experience
* Metrics
* Employer names
* Academic results

If information is missing, the AI should ask the user or clearly indicate that evidence is unavailable.

---

## 4. Target Users

### Primary

* Sri Lankan university undergraduates
* Internship seekers
* Final-year students
* Fresh graduates

### Secondary

* Entry-level job seekers
* Early-career professionals
* Career switchers

Initial focus should be:

* Data Science
* Data Analytics
* Software Engineering
* IT
* Cybersecurity
* Business Analysis
* Business Information Systems

The architecture should remain extensible to other careers.

---

## 5. Main User Journey

### First Visit

Landing page → Interactive introduction → Start Chatting

### Chat

The AI asks naturally what the user needs.

The user may say:

> "mata internship ekak oni"

The AI gathers only the necessary information conversationally.

It should not force users through a long registration form.

The AI should request:

* CV upload, if available
* Portfolio URL, if available
* GitHub/LinkedIn information, if relevant
* Target role
* Location preference
* Internship/full-time preference
* Remote/hybrid preference

---

## 6. CV Processing

Users can upload a CV.

The system should extract structured information including:

* Name
* Education
* University
* Degree
* Skills
* Technologies
* Experience
* Projects
* Certifications
* Achievements
* Languages
* Portfolio
* GitHub
* LinkedIn

The extracted information should become the candidate profile.

The system should preserve the original CV.

---

## 7. Portfolio Analysis

Users can provide a portfolio URL.

CareerLens should analyze available public portfolio information including:

* About section
* Skills
* Projects
* Project descriptions
* Experience
* Contact information
* Portfolio structure
* Basic SEO factors
* Recruiter readability
* Job relevance

The system should provide actionable recommendations.

Example:

> Your Power BI skill is listed, but there is no project demonstrating it. Consider adding a Power BI project if you have actually completed one.

---

## 8. Job Discovery

CareerLens should focus on Sri Lankan opportunities.

Potential sources include:

* Sri Lankan job portals
* Company career pages
* University career pages
* Other permitted public sources

LinkedIn should be supported primarily through search/navigation and user-provided job information unless official API access is available.

The system must not implement unauthorized LinkedIn scraping.

CareerLens should store normalized job information using a common schema.

---

## 9. Job Object

Each job should support:

* ID
* Job title
* Company
* Location
* Employment type
* Description
* Responsibilities
* Required skills
* Preferred skills
* Education requirements
* Experience requirements
* Salary if publicly available
* Posted date
* Closing date
* Source
* Original URL

---

## 10. Job Matching

The system should combine deterministic matching and AI/semantic analysis.

Initial dimensions:

* Skill match
* Semantic similarity
* Project relevance
* Experience
* Education
* Evidence strength

Initial conceptual weighting:

* Skill Match: 35%
* Semantic Similarity: 20%
* Project Relevance: 15%
* Experience: 10%
* Education: 10%
* Evidence: 10%

These weights should remain configurable.

The final system should later support experimentation with different weighting strategies.

---

## 11. Match Explanation

CareerLens should not only provide a percentage.

Example:

> Match: 88%

Then show:

### Strong Matches

* Python
* SQL
* Power BI
* Data Visualization

### Partial Matches

* Excel

### Gaps

* Tableau

### Evidence

Explain where skills are demonstrated in the candidate's CV/projects/portfolio.

---

## 12. Resume Evaluation

When the user selects a job, CareerLens should compare the resume against the job description.

Analyze:

* Required keyword coverage
* Skill alignment
* Project relevance
* Experience relevance
* Evidence
* Clarity
* ATS-friendly structure
* Missing information
* Weak evidence

The system should identify keywords but must not encourage keyword stuffing.

---

## 13. Resume Refinement

The system can suggest or generate improved resume content based on the selected vacancy.

Rules:

* Never fabricate experience.
* Never invent metrics.
* Never claim skills the candidate does not have.
* Preserve truthful candidate information.
* Prefer measurable evidence when the user has supplied it.
* Ask the user for missing facts where appropriate.

---

## 14. Cover Letter

CareerLens should create a job-specific cover letter based on:

* Candidate profile
* Selected job
* Company
* Job requirements
* Candidate's genuine experience

The cover letter should not be generic.

---

## 15. Interview Agent

The user can request:

> "machan interview ekata practice karamu"

CareerLens enters interview mode.

It should generate questions based on the selected job.

Question categories:

* Introduction
* Behavioral
* Technical
* Scenario-based
* Project-related
* Job-specific

The agent should evaluate user responses and provide constructive feedback.

---

## 16. Language Behavior

The conversation layer supports:

English:

> "I found three strong matches for your profile."

Singlish:

> "Ado, jobs tika hoyagatta. Me first eka nam oyata hodata match."

Sinhala:

> "ඔබගේ skills වලට ගැලපෙන internship අවස්ථා කිහිපයක් හම්බුණා."

Mixed:

> "Me job eka oyage Python + SQL skills walata hondatama match."

The system should naturally mirror the user's preferred communication style.

---

## 17. Landing Page

The landing page should be visually premium but friendly.

Theme:

* Sea breeze
* Ocean
* Blue
* Sky
* Deep navy
* White
* Soft gradients

Technology:

* Next.js
* Three.js / React Three Fiber
* Framer Motion

The landing page should contain:

1. Hero
2. Interactive AI introduction
3. Example conversation
4. CareerLens capabilities
5. Career journey
6. Final CTA

Primary CTA:

> Start Chatting

The landing page should introduce the AI interactively rather than functioning like a traditional corporate landing page.

---

## 18. UI Principle

The chatbot is the main interface.

Avoid excessive forms.

The user should feel like they are talking to a career buddy.

The dashboard can provide supporting functionality:

* Chat
* Jobs
* My CV
* Portfolio
* Matches
* Applications
* Interview

---

## 19. Technology Stack

Frontend:

* Next.js
* TypeScript
* React
* Tailwind CSS
* Framer Motion
* Three.js
* React Three Fiber

Backend:

* Next.js API routes / server-side functions
* Supabase (PostgreSQL, Auth, Storage)

AI:

* Gemini API

Database:

* Supabase PostgreSQL, accessed directly via the Supabase client (no Prisma)

Future semantic search:

* pgvector (via Supabase)

Deployment:

* Vercel

---

## 20. Architecture Principle

Do not send every task directly to the LLM.

Use deterministic application logic for:

* Database operations
* Filtering
* Ranking
* Calculations
* Validation
* Duplicate detection
* Match scoring
* Evaluation

Use Gemini for:

* Natural language understanding
* Conversational interaction
* Structured information extraction
* Job description interpretation
* Explanations
* Recommendations
* Resume refinement
* Cover letters
* Interview conversation

---

## 21. Initial AI Tools

The Career Agent should eventually have access to tools such as:

* searchJobs
* getJob
* extractCandidateProfile
* analyzeResume
* analyzePortfolio
* analyzeJob
* calculateMatch
* identifySkillGaps
* evaluateResume
* improveResume
* generateCoverLetter
* prepareInterview

The agent should use tools rather than attempting to perform all operations through one giant prompt.

---

## 22. Security

Never expose API keys to the client.

Sensitive operations must run server-side.

Validate uploaded files.

Restrict file types.

Limit file sizes.

Sanitize external URLs.

Never execute arbitrary user-provided code.

Do not expose internal prompts or API credentials.

---

## 23. MVP

MVP must include:

1. Landing page
2. Chat interface
3. Gemini integration
4. Sinhala/Singlish/English conversation
5. CV upload
6. CV extraction
7. Candidate profile
8. Job database
9. Sri Lankan job search
10. Job matching
11. Match explanation
12. Skill-gap analysis
13. Resume evaluation
14. Resume refinement
15. Cover letter generation
16. Interview preparation
17. External application links

Do not build automatic job application submission in the MVP.

---

## 24. Development Philosophy

Build incrementally.

Do not generate the entire application at once.

Each feature must be:

* Implemented
* Tested
* Reviewed
* Refactored where necessary

Before moving to the next major feature.

Keep components modular.

Keep business logic separate from UI.

Keep AI logic separate from database logic.

Keep job-source adapters separate from the rest of the application.

Do not introduce unnecessary technologies.

Do not over-engineer the MVP.

---

## 25. Research Component

The project should support later experimentation comparing:

1. Keyword matching
2. TF-IDF similarity
3. Embedding similarity
4. Hybrid matching

Potential evaluation metrics:

* Precision@K
* Recall@K
* F1
* NDCG@K
* Human relevance ratings

The matching engine should therefore be designed so that different algorithms can be tested independently.

---

## 26. Important Rule for Claude Code

Do not implement the complete project in one step.

First inspect the specification.

Explain the proposed implementation plan.

Then implement only the requested phase.

After implementation:

* Run lint
* Run type checking
* Run tests
* Verify the application
* Report files changed
* Report remaining issues

Never silently make major architectural changes.

Never replace working functionality without justification.

Always preserve the project's core architecture and requirements.
