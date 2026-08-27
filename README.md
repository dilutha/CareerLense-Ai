# CareerLens AI

A friendly, conversational AI career assistant for Sri Lankan undergraduates
and early-career job seekers. See [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)
for the full product specification.

> **Status:** Phase 8 — job-specific CV tailoring, ATS/keyword alignment
> analysis, and tailored cover letter generation. No portfolio crawling,
> interview agent, or application tracking yet. Job results are currently
> **demo/fixture data** — no live search provider is configured (see
> [Job discovery](#job-discovery--matching) below).
> **None of the four database migrations have been applied to the live
> Supabase project** — see [Applying the migrations](#applying-the-migrations)
> below; nothing that touches the database (profiles, resumes, jobs,
> tailored applications) works until you do.

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
lib/
  ai/                 AI abstraction layer (see docs/AI_AGENT.md)
  auth/               Server-side auth guards (requireUser) + friendly error mapping
  career-profile/     Fetch/mutate profile data, build AI context, completion score
  resume/             CV upload, text extraction, Gemini parsing/scoring (see docs/AI_AGENT.md)
  jobs/               Job discovery, matching, chat integration (see docs/AI_AGENT.md, docs/JOB_DATA.md)
  application/         Deterministic resume-vs-job comparison, CV tailoring +
                        cover letter generation (see docs/AI_AGENT.md, docs/DATABASE.md)
  portfolio/          Portfolio analysis logic — not yet implemented
  supabase/           Supabase clients (browser, server, admin, middleware) + types
  env.ts              Server-side environment variable validation
supabase/migrations/   SQL migrations (schema source of truth)
proxy.ts               Session refresh + protected-route redirects (Next.js 16's
                        renamed `middleware.ts`)
docs/                 Project specification and architecture docs
```

## Authentication

Email/password via Supabase Auth. `/chat`, `/profile`, `/resume`,
`/jobs`, and `/application` are protected — both by `proxy.ts` (edge-level redirect to
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
themselves (**not yet applied to the live project** — see below).

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
internship in Colombo"), CareerLens searches configured job sources,
matches results against your career profile + CV, and shows ranked cards
with a **CareerLens Match** score. The score is computed deterministically
(skills 35%, role alignment 20%, experience 15%, education 10%,
location 10%, keywords 10% — see `docs/DATABASE.md`) — Gemini never sets
the number directly, only extracts each job's requirements once and, on
request, narrates an already-computed score in plain language. **No real
job source is configured yet** (`JOB_SEARCH_API_KEY` unset) — every result
right now comes from a small set of clearly-labeled fictional listings
(`lib/jobs/providers/demo.ts`), and the UI marks every one of them "Demo
data". See [`docs/JOB_DATA.md`](docs/JOB_DATA.md) for the full provider
architecture and what it would take to turn on a real source.

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

### Applying the migrations

None of the four migration files have been run against the live Supabase
project yet (verified directly against the REST API — a `PGRST205: table
not found` response for every table, distinguished from the `401` a
genuinely invalid key would return). Until they are, signup/login work
(Supabase Auth doesn't need them), but profile, resume, job, and
application-tailoring features will not. Apply all four, **in order**,
either:

- **Supabase Dashboard → SQL Editor** — paste the contents of
  `supabase/migrations/001_initial_career_profile.sql` and run it, then
  `002_resume_intelligence.sql`, then `003_job_discovery.sql`, then
  `004_job_application_tailoring.sql`, or
- **Supabase CLI** — `supabase link --project-ref <ref>` then `supabase db push`
  (requires your database password).

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
| `JOB_SEARCH_PROVIDER` | Optional. `demo` (default) or `search`. See [Job discovery](#job-discovery--matching). |
| `JOB_SEARCH_API_KEY` | Server-side only. Not required yet — no real search provider is implemented. |
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

Tests ([Vitest](https://vitest.dev)) currently cover the deterministic,
non-Gemini logic only — skill alias canonicalization, related-skill
partial matching, resume-vs-job comparison, and Zod validation of
tailoring data shapes (`lib/jobs/skill-aliases.test.ts`,
`lib/application/*.test.ts`). Gemini calls and Supabase-backed Server
Actions aren't covered by automated tests yet — they're verified by
manual/live checks instead.

## Deploy

Intended for deployment on [Vercel](https://vercel.com).
