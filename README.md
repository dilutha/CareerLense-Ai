# CareerLens AI

A friendly, conversational AI career assistant for Sri Lankan undergraduates
and early-career job seekers. See [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)
for the full product specification.

> **Status:** WSO2 API Manager integration — a versioned REST API
> (`/api/v1`, 22 routes) meant to sit behind WSO2 as an API management/
> security layer (OAuth2, rate limiting, versioning, analytics), separate
> from the existing streaming `/api/chat`. **WSO2 itself was not
> installed/run in this environment** — only the backend it points at is
> live-verified. See [`docs/WSO2_API.md`](docs/WSO2_API.md) for the full
> architecture and the honest status. On top of that: a stateful
> conversational job-search agent (Phase 21) that refines results across
> turns ("international company ekak nam hodai") without re-asking, real
> chat persistence with a working sidebar (rename/delete), and a
> chat-first onboarding flow. On top of that: Phase 12's Notifications &
> Reminders — set a real follow-up date or interview date/time on a
> tracked application (or just tell the chatbot — "remind me to follow up
> with WSO2 next Monday") and get a reminder in the `/notifications`
> center or the bell on `/career`/`/applications`; status changes
> (Applied → Interview, etc.) create a notification automatically. See
> [Notifications & reminders](#notifications--reminders) below. On top
> of that: Phase 11's Application Tracking, Skill Gap Intelligence,
> Personalized Learning Roadmaps, and Career Analytics — track a real
> pipeline from Saved through Offer/Rejected at `/applications`, see
> real market-demand skill gaps at `/career/skills`, get a deterministic
> learning plan with hand-verified resource links at `/career/roadmap`,
> and real interview/offer/response rate math at `/analytics` — see
> [Application tracking, skill gaps & learning](#application-tracking-skill-gaps--learning-roadmaps)
> below. On top of that: Phase 10A's SerpApi Google Jobs
> worldwide/aggregator provider (verified against SerpApi's own docs, but
> **not live-tested** — no `SERPAPI_API_KEY` configured here, so it
> honestly reports "configuration required") and genuinely live ITPro.lk
> discovery, Phase 10's Portfolio/GitHub/LinkedIn intelligence and
> job-specific Interview Coach, and Phase 9's deterministic multi-source
> matching/dedup/ranking. See [Job discovery](#job-discovery--matching)
> below for exactly what's live vs. configuration-pending per source.
> **Migrations 001-011 are applied to the live Supabase project** (the
> WSO2 phase added no new migration — see
> [Applying the migrations](#applying-the-migrations)).

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- [Framer Motion](https://motion.dev)
- [Three.js](https://threejs.org) / [React Three Fiber](https://r3f.docs.pmnd.rs)
- [Lucide React](https://lucide.dev)
- [Supabase](https://supabase.com) — PostgreSQL (with RLS), Auth, Storage
- [Google Gen AI SDK](https://www.npmjs.com/package/@google/genai) (Gemini) — server-side only
- [Zod](https://zod.dev) — server-side validation, including Gemini's
  structured-output schema for resume analysis
- [unpdf](https://github.com/unjs/unpdf) / [mammoth](https://github.com/mwilliamson/mammoth.js) — server-side PDF/DOCX text extraction

## Project structure

```text
app/                  Next.js App Router pages
  chat/               Real chat UI (Gemini-backed, protected route)
  login/, signup/     Auth pages
  profile/            Career profile dashboard incl. resume list (protected)
  profile/setup/      Step-based onboarding wizard (protected route)
  resume/[id]/         Resume review page (protected route)
  jobs/               Job search page (protected route)
  jobs/[id]/           Job detail + match analysis (protected route)
  jobs/saved/          Saved jobs (protected route)
  application/[jobId]/ Application Optimization Dashboard — CV tailoring +
                        cover letter generation (protected route)
  portfolio/           Portfolio Intelligence dashboard (protected route)
  github/               GitHub Intelligence dashboard (protected route)
  linkedin/             LinkedIn Optimization dashboard (protected route)
  interview/            Interview Coach — start + history (protected route)
  interview/[sessionId]/ Mock interview Q&A + summary (protected route)
  career/               Career Insights dashboard (protected route)
  career/skills/         Skill Gap Intelligence (protected route)
  career/roadmap/         Personalized Learning Roadmap (protected route)
  applications/           Application Tracking board (protected route)
  applications/[id]/       Application detail (protected route)
  analytics/               Career Analytics dashboard (protected route)
  notifications/           Notification center (protected route)
  auth/callback/       Exchanges email-confirmation code for a session
  api/chat/            NDJSON endpoint that streams the career agent's reply
components/
  ui/                 Reusable, generic UI primitives
  landing/            Landing-page sections (Hero, Navbar, Footer, etc.)
  chat/               Chat-interface-specific components
  auth/               LoginForm, SignupForm, LogoutButton
  profile/            Onboarding wizard + profile dashboard sections
  resume/             Uploader, resume list/card, score, analysis sections
  jobs/               JobCard, JobResultList, JobSearchPage — shared between /jobs and chat
  application/         Skill/keyword comparison, tailored CV + cover letter
                        preview, version history
  portfolio/, github/, linkedin/, interview/, career/
                        Score/findings displays, content-draft generators,
                        mock-interview flow, career readiness panel, skill
                        gap + roadmap dashboards
  applications/, analytics/, notifications/
                        Application board/detail, career analytics dashboard,
                        notification bell/list/upcoming widget
lib/
  ai/                 AI abstraction layer (see docs/AI_AGENT.md)
  auth/               Server-side auth guards (requireUser) + friendly error mapping
  career-profile/     Fetch/mutate profile data, build AI context, completion score
  resume/             CV upload, text extraction, Gemini parsing/scoring (see docs/AI_AGENT.md)
  jobs/               Job discovery, matching, chat integration (see docs/AI_AGENT.md, docs/JOB_DATA.md)
  application/         Deterministic resume-vs-job comparison, CV tailoring +
                        cover letter generation (see docs/AI_AGENT.md, docs/DATABASE.md)
  portfolio/           URL fetch/extraction, deterministic scoring, content generation
  github/               Public GitHub REST API client, deterministic scoring
  linkedin/             Pasted-content analysis (no fetching), scoring, content generation
  interview/            Question generation, answer evaluation, mock-interview sessions
  career/               Cross-domain readiness + next-best-action + market skill
                        demand + skill-gap priority + live insights (see docs/DATABASE.md)
  applications/          Application CRUD/status history, statistics, source/
                        resume performance, analytics summary
  learning/              Deterministic roadmap building + curated resource
                        catalog + Gemini narration (see docs/AI_AGENT.md)
  notifications/          Deterministic reminder computation/reconciliation,
                        Colombo-time-aware date parsing, chat reminder intent
                        (see docs/AI_AGENT.md, docs/DATABASE.md)
  supabase/           Supabase clients (browser, server, admin, middleware) + types
  env.ts              Server-side environment variable validation
supabase/migrations/   SQL migrations (schema source of truth)
proxy.ts               Session refresh + protected-route redirects (Next.js 16's
                        renamed `middleware.ts`)
docs/                 Project specification and architecture docs
```

## Authentication

Email/password via Supabase Auth. `/chat`, `/profile`, `/resume`,
`/jobs`, `/application`, `/portfolio`, `/github`, `/linkedin`,
`/interview`, `/career`, `/applications`, `/analytics`, and `/notifications` are protected — both by `proxy.ts` (edge-level redirect to
`/login?next=<path>`) and again by each page's own server-side check, per
Next.js's own guidance not to rely on proxy/middleware alone. Sessions are
cookie-based (`@supabase/ssr`) so they survive page refreshes and server
rendering — no tokens are ever stored in `localStorage`.

## Database

Supabase PostgreSQL, with Row Level Security enabled on every user-owned
table — a user can only ever read or write their own data, enforced at the
database layer regardless of application code. See
[`docs/DATABASE.md`](docs/DATABASE.md) for the schema and
[`supabase/migrations/`](supabase/migrations/) for the migrations
themselves (**all applied to the live project for this deployment** — see
below).

## User profile

CareerLens stores structured career information: education, skills,
experience, projects, and career preferences — not one big JSON blob, so
future phases can do real matching/analysis against it. New users get a
short conversational onboarding (`/profile/setup`); everything past name
and target role is optional and can be filled in later from `/profile`.
When a signed-in user chats, their profile is compressed into a short
context block and given to Gemini — see
[`docs/AI_AGENT.md`](docs/AI_AGENT.md).

## CV upload & resume intelligence

From `/profile`, upload a PDF or DOCX (max 10 MB) to a private Supabase
Storage bucket. The server extracts text, sends it to Gemini for combined
parsing + evaluation in one request, and stores the result — a resume
score (six category breakdown, computed deterministically from Gemini's
findings, not trusted as a raw number), strengths, weaknesses, detected
skills, and suggestions, viewable at `/resume/[id]`. A resume is kept
separate from the career profile — nothing is auto-merged in; skills
detected in a CV but missing from your profile just show up as a
suggestion. The most recent ready resume also feeds a compact summary into
the chat context, alongside the career profile.

## Job discovery & matching

From `/jobs` (or by asking in chat, e.g. "find me a data analyst
internship in Colombo"), CareerLens searches multiple real sources
concurrently — **ITPro.lk** (a live public API, verified directly),
**SerpApi Google Jobs** (worldwide/aggregator discovery — implemented and
verified against SerpApi's documentation, but not live-tested here; no
`SERPAPI_API_KEY` configured, so it honestly reports "configuration
required"), and a company-careers provider (schema.org JobPosting
extraction — real mechanism, no pages seeded yet, see `docs/JOB_DATA.md`)
— normalizes, deduplicates across sources (the same vacancy on two sites
is shown once, with both sources noted, via `jobs.duplicate_of` — no
separate junction table needed for this), matches results against your
career profile + CV, and shows ranked cards with a **CareerLens Match**
score plus a source-confidence label (HIGH for a direct API/self-fetched
page, MEDIUM for an aggregator result, since SerpApi's own docs don't
guarantee its apply links always resolve to the original poster). The
match score is computed deterministically (skills 35%, role alignment
20%, experience 15%, education 10%, location 10%, keywords 10%, plus a
small bounded freshness nudge in the final ranking — see
`docs/DATABASE.md`) — Gemini never sets the number directly, only
extracts each job's requirements once and, on request, narrates an
already-computed score in plain language.

LinkedIn is never scraped directly — it can only appear via SerpApi's
Google Jobs aggregation (when configured) with its own real apply link
preserved, or through a manual "paste a job URL" import; XpressJobs/
ikman.lk have the same manual-only fallback (no public API exists for
either — see `docs/JOB_DATA.md`). A demo/fixture provider still exists
for local development (`JOB_SEARCH_PROVIDER=demo`), always clearly
labeled and never mixed silently with real results.

**APYHub was evaluated for webpage-content extraction and found not
required** — a real endpoint exists, but a 5-calls/day free tier and
visible-text-only output (no structured metadata) mean it adds nothing
CareerLens's own `lib/portfolio/extract.ts` doesn't already do for free.
No `apyhub.ts` provider was added.

## Job-specific CV tailoring & cover letters

From a job's detail page, "Tailor My Application" opens
`/application/[jobId]` — pick one of your existing (ready) CVs, and
CareerLens runs a **deterministic** (non-Gemini) comparison against that
job's requirements: each required skill is marked as a strong match,
match, partial (via a small curated related-skill list — e.g. Power BI
counts as a partial match for a Tableau requirement, never a full one),
missing, or insufficient evidence, plus an overall keyword alignment
percentage. From there, "Tailor My CV" and "Create Cover Letter" each make
one Gemini call, but only ever from a closed set of facts built from your
own career profile + the selected resume — the model is explicitly
forbidden from introducing any skill, employer, project, or metric that
isn't in that set, so a job requiring something you don't have gets
flagged as missing, never fabricated. Both the tailored CV and the cover
letter are versioned (your original resume is never modified), with a
version history panel and a print/PDF-friendly layout (`window.print()`,
no new PDF dependency). See [`docs/AI_AGENT.md`](docs/AI_AGENT.md) and
[`docs/DATABASE.md`](docs/DATABASE.md) for the full pipeline.

## Career intelligence — Portfolio, GitHub, LinkedIn, Interview Coach

Four more dashboards, each with its own scoring and history, tying back
into the same job you're targeting:

- **`/portfolio`** — paste your portfolio URL. Fetched with the same
  SSRF/robots.txt guard as job sources (`lib/jobs/url-safety.ts`, reused
  not duplicated), deterministically extracted for SEO/structural signals
  (title, meta description, headings, canonical, OG, structured data,
  image alt coverage), then scored across 6 weighted categories from
  Gemini's findings — the score itself is always computed in application
  code, the same base+impact pattern resume scoring has always used. Can
  also draft hero/about/project copy, grounded only in your real
  profile/CV.
- **`/github`** — enter your GitHub username. Reads only your PUBLIC
  profile and non-fork repositories via GitHub's official REST API
  (unauthenticated, 60 requests/hour — verified live), scores career
  relevance against your target role, and suggests concrete project ideas
  to fill real gaps.
- **`/linkedin`** — paste your headline/About/skills content. LinkedIn is
  never fetched or scraped (its Terms of Service prohibit it, and there's
  no self-serve API for this) — this is the only input path, by
  construction. Generates 3 headline options + an About draft + a
  keep/add/deprioritize skills list.
- **`/interview`** — start a mock interview, optionally for a specific
  saved job. Questions are grounded in your actual profile/CV (and that
  job's real requirements) — a "project" question always names an actual
  project you have, never an invented one. Each answer gets an "Answer
  Quality Score" (relevance/structure/clarity/technical accuracy/
  conciseness) — explicitly not a prediction of real interview or hiring
  success.
- **`/career`** — a deterministic Career Readiness score (CV 20% /
  Portfolio 20% / Skills 20% / Projects 15% / LinkedIn 10% / GitHub 10% /
  Interview 5%) that excludes whatever hasn't been analyzed yet rather
  than scoring it 0, plus a Next-Best-Action recommendation. The job
  detail page shows the same idea scoped to one specific job.

See [`docs/AI_AGENT.md`](docs/AI_AGENT.md) and
[`docs/DATABASE.md`](docs/DATABASE.md) for the full scoring methodology.

## Application tracking, skill gaps & learning roadmaps

Four more pages, none of them the conversational chat model except for one
narrow narration call:

- **`/applications`** — every job you're tracking moves through an
  11-status pipeline (Saved → Interested → Preparing → Applied → Screening
  → Interview → Final Round → Offer / Rejected / Withdrawn / Closed) via a
  plain status dropdown, deliberately not a drag-and-drop kanban. Every
  status change is recorded in an append-only history (no
  update/delete — the only way to change history is to add to it), so
  "did this ever reach interview?" is answered from real history, not
  just the current status (a rejection can happen at any stage, so
  current status alone can't say whether an interview happened first).
  `/applications/[id]` shows the full timeline, follow-up date, notes, and
  which CV/cover-letter version was used once tailoring has happened.
- **`/career/skills`** — market skill demand computed from real, already-
  stored `job_skills` rows for jobs matching your target role — never an
  invented percentage. Classifies your own skills against that demand
  (strong/developing/missing/emerging) and prioritizes what to learn next
  by real demand, not a guess.
- **`/career/roadmap`** — a fully deterministic step-by-step learning plan
  built from that same priority list. Resource links come only from a
  small, hand-curated catalog of individually verified real URLs — Gemini
  writes a short narration of *why* this order makes sense, but never
  chooses a step, an order, or a link, so a hallucinated course URL is
  structurally impossible.
- **`/analytics`** — interview rate, offer rate, response rate, average
  match score, top applied role, and top skill gap, all plain
  SQL/TypeScript math over your own tracked applications — every rate is
  `null` (shown as "—"), never `NaN%`/`Infinity%`, when you haven't
  submitted anything yet. Resume performance groups by your ORIGINAL
  uploaded CV (not the per-job tailored version, which restarts at 1 for
  every job), and only surfaces an "observed association, not causation"
  note once you have at least two CVs with 3+ applications each to
  compare.

Career Readiness (`/career`) gained an 8th component, **Applications**
(8% weight, the other seven rebalanced down proportionally from Phase
10), scored from your real response rate and excluded (not zeroed) until
you've submitted at least one application.

See [`docs/AI_AGENT.md`](docs/AI_AGENT.md) and
[`docs/DATABASE.md`](docs/DATABASE.md) for the full pipeline.

## Notifications & reminders

Set a real follow-up date or interview date/time on any tracked
application (`/applications/[id]`) — or just tell the chatbot naturally
("remind me to follow up with WSO2 next Monday", "interview eka Friday
10am") — and CareerLens creates real, non-duplicating reminders:

- **Follow-up reminders** — one, at 9am Colombo time on the date you set.
- **Interview reminders** — two, 24 hours and 1 hour before the interview
  (only the ones still ahead of "now" are created).
- **Application deadline reminders** — only when the job's real source
  data includes a closing date (`jobs.expires_at`); no source currently
  populates this, so this type is implemented but produces nothing yet —
  never a fabricated deadline.
- **Status-change notifications** — created automatically the moment an
  application's status changes (e.g. Applied → Interview), in a
  supportive, never-manipulative tone.

Everything is computed deterministically
(`lib/notifications/compute-reminders.ts`) and reconciled idempotently
(`lib/notifications/sync.ts`) — the same source date always produces the
same reminder, backed by real database `UNIQUE` constraints, so a page
refresh or a retried action can never create a duplicate. When the
chatbot is involved, Gemini only extracts/normalizes intent (translating
a date phrase like "ලබන සඳුදා" into "next Monday") — a fully
deterministic parser (`lib/notifications/parse-datetime.ts`, anchored to
Asia/Colombo) is the only thing that ever computes the real scheduled
timestamp; Gemini never invents one, and never guesses which application
you mean.

Reminders show up at `/notifications`, with a bell + unread badge on
`/career` and `/applications`, plus a simple "Upcoming" list (today/
tomorrow/in N days) on `/career`. **There is no email or push
notification, and no background worker/cron in this deployment** — a
reminder becomes visible the next time you load a page that reads
notifications, at or after its scheduled time. See
[`docs/AI_AGENT.md`](docs/AI_AGENT.md) and
[`docs/DATABASE.md`](docs/DATABASE.md) for the full architecture.

### Applying the migrations

Migrations 001-011 have already been applied to the live Supabase project
for this deployment (verified directly — `supabase migration list
--linked`, and every expected table/column/policy/constraint was
independently checked for every migration). If you're pointing this app
at a **different, fresh** Supabase project, apply all eleven, **in
order**, either:

- **Supabase Dashboard → SQL Editor** — paste and run each file in order:
  `001_initial_career_profile.sql`, `002_resume_intelligence.sql`,
  `003_job_discovery.sql`, `004_job_application_tailoring.sql`,
  `005_job_source_ingestion.sql`, `006_career_intelligence.sql`,
  `007_job_source_expansion.sql`, `008_career_tracking.sql`,
  `009_notifications.sql`, `010_chat_persistence.sql`,
  `011_agent_state.sql`, or
- **Supabase CLI** — `supabase link --project-ref <ref>` then
  `supabase db push --linked` (uses the CLI's logged-in access token via
  the Management API — no database password needed once linked).

## Versioned REST API (`/api/v1`) — WSO2 API Manager

A stable, non-streaming REST API — 22 route files, 27 documented paths —
covering career profile, resume intelligence, job discovery/matching, and
application optimization/AI career analysis. Bearer-token authenticated
(a real Supabase user access token, not a cookie — a non-browser API
client can't rely on cookies), meant to sit behind
[WSO2 API Manager](https://wso2.com/api-manager/) for OAuth2, rate
limiting, versioning, and analytics. See
[`docs/WSO2_API.md`](docs/WSO2_API.md) for the full architecture,
[`docs/openapi.yaml`](docs/openapi.yaml) for the machine-readable API
definition (importable directly into the WSO2 Publisher), and the same
doc's honest note that **WSO2 itself was not installed/run in this
environment** — only the backend it points at is live-verified.

## Gemini setup

1. Create an API key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Add it to `.env.local` as `GEMINI_API_KEY` (never commit this file — it's gitignored).
3. It is read only in `lib/ai/client.ts`, a server-only module (`import "server-only"` makes it a build error to import from a Client Component) — it never reaches the browser.
4. Start the dev server (`npm run dev`) and open `/chat`.

Request flow: **Browser → `/api/chat` (Next.js Route Handler) → Career Agent → Gemini (streamed) → NDJSON events flow back to the browser** (plain text chunks, plus job-search-result cards when relevant — see `docs/AI_AGENT.md`). The browser never talks to Gemini directly and never sees the API key.

## Getting started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Environment variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env.local
```

| Variable | Description |
| --- | --- |
| `GEMINI_API_KEY` | Server-side only. Required for `/chat` to work. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-3.6-flash` if unset. |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key (safe for the browser). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (safe for the browser). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only. Never expose to the client. Used only for job listing ingestion (`lib/jobs/discovery.ts`). |
| `JOB_SEARCH_PROVIDER` | Optional. `real` (default — ITPro.lk + SerpApi + company-careers) or `demo` (fixtures only). See [Job discovery](#job-discovery--matching). |
| `ITPRO_API_KEY` | Optional. Not required for the job reads this app performs (verified live) — only needed if ITPro later requires a key for reads. |
| `SERPAPI_API_KEY` | Server-side only. Optional — without it, the SerpApi provider reports "configuration required" honestly rather than failing. Get one at [serpapi.com](https://serpapi.com/manage-api-key). |
| `GITHUB_TOKEN` | Optional. Raises GitHub's public API rate limit (60 req/hr unauthenticated) if set — never required, never used for private-repo access. |
| `NEXT_PUBLIC_APP_URL` | Base URL of the app (e.g. `http://localhost:3000`). |

### Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Lint, build & test

```bash
npm run lint
npm run build
npm test
```

Tests ([Vitest](https://vitest.dev), 348 passing) cover the deterministic,
non-Gemini logic across every phase — skill alias canonicalization,
related-skill partial matching, resume-vs-job comparison, job
normalization/deduplication/ranking, SerpApi response normalization
(mocked — no real paid API calls in tests), relative-date parsing, query
expansion, SSRF URL validation, portfolio HTML extraction, GitHub API
response normalization, an end-to-end pipeline integration test (mocked
multi-source results with a genuine cross-source duplicate), the weighted
scoring/career-readiness/next-best-action logic, Phase 11's application
statistics (interview/offer/response rate math, division-by-zero/null
safety, history-based interview detection), source/resume performance
grouping, analytics summary, market-skill classification, skill-gap
prioritization, deterministic roadmap step-building, the curated resource
catalog's never-fabricates-a-URL guarantee, and Phase 12's deterministic
reminder computation (follow-up/interview/deadline offset math, never a
past-dated or fabricated reminder), the reconciliation/idempotency diff
logic, Asia/Colombo date-time round-tripping, the natural-language
reminder-date parser (tomorrow/next Monday/Friday 10am/in N days/ISO
dates, unparseable and past-date rejection), application-hint matching
(exactly-one-match-or-null, never a guess), notification message
templates, conversation title generation, and Phase 21's agent-state
logic (schema validation rejecting invalid/hallucinated shapes, the
merge function's whole-field-replace semantics including the real
`.partial()`-with-defaults Zod bug it caught along the way, ordinal
job-reference resolution, conversational hard-filtering + "show more"
dedup, and the state-to-JobSearchQuery mapping) (`lib/jobs/*.test.ts`,
`lib/application/*.test.ts`, `lib/portfolio/*.test.ts`,
`lib/github/*.test.ts`, `lib/linkedin/*.test.ts`, `lib/interview/*.test.ts`,
`lib/career/*.test.ts`, `lib/applications/*.test.ts`,
`lib/learning/*.test.ts`, `lib/notifications/*.test.ts`,
`lib/chat/*.test.ts`, `lib/agent-state/*.test.ts`, `lib/utils/*.test.ts`).
Gemini calls and
Supabase-backed Server Actions aren't covered by automated tests yet —
they're verified by manual/live checks instead (`import "server-only"`
modules are directly testable via `vitest.config.mts`'s `react-server`
resolve condition, matching Next.js's own RSC bundler resolution, with
placeholder Supabase env vars supplied via `vitest.config.mts`'s
`test.env` so modules that construct a client at import time can load
under vitest without a real project).

## Deploy

Intended for deployment on [Vercel](https://vercel.com).
