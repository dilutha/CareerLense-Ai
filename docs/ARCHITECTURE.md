# Architecture

Status: Phases 1–12 plus a chat-first UX refactor and Phase 21 are
implemented (foundation, landing page, chat UI, Gemini integration,
authentication + career profile, CV upload + resume intelligence, job
discovery + matching, CV tailoring + cover letters, multi-source job
discovery, portfolio/GitHub/LinkedIn intelligence + interview coach, real
job source expansion, application tracking + skill gap intelligence +
learning roadmaps + career analytics, notifications + reminders, real
chat persistence with a working sidebar, a stateful conversational
job-search agent that refines results across turns without the user
repeating themselves, and a versioned `/api/v1` REST API intended to sit
behind WSO2 API Manager — see [`docs/WSO2_API.md`](WSO2_API.md) for the
full API management architecture; WSO2 itself was not installed/run in
this environment, only the backend it points at). See
`docs/DATABASE.md` for exactly which migrations are applied to the live
Supabase project as of the current phase. The rest of this document
describes the target architecture as later phases land.

## Stack

- **Frontend/Backend:** Next.js (App Router), TypeScript, deployed as one app
- **Styling:** Tailwind CSS v4, Framer Motion, Three.js / React Three Fiber
- **Database:** Supabase PostgreSQL
- **Authentication:** Supabase Auth (email/password)
- **File storage:** Supabase Storage — private `resumes` bucket
- **AI:** Gemini API, via `@google/genai`
- **Document parsing:** `unpdf` (PDF), `mammoth` (DOCX) — server-only
- **Job discovery:** provider abstraction (`lib/jobs/providers/`) — ITPro.lk
  live by default (real API, verified), SerpApi Google Jobs implemented
  (worldwide/aggregator provider, surfaces LinkedIn/Indeed/company-site
  listings — verified against docs, not live-tested, no key configured),
  plus a company-careers provider (schema.org JobPosting extraction, no
  pages seeded yet); demo fixtures are opt-in only
  (`JOB_SEARCH_PROVIDER=demo`, see `docs/JOB_DATA.md`)
- **Career intelligence:** GitHub's official public REST API (unauthenticated,
  60 req/hr, verified live); portfolio pages fetched with the same
  SSRF/robots.txt guard as job sources; LinkedIn is never fetched — only
  user-pasted content (see `docs/JOB_DATA.md`, `docs/AI_AGENT.md`)

```text
Browser
   │
   ▼
Next.js (proxy.ts session refresh + route protection)
   │
   ├── Server Components / Server Actions ──▶ Supabase (Auth, PostgreSQL — RLS-scoped, Storage)
   │
   ├── Resume upload/processing (Server Actions, lib/resume/)
   │      Storage → text extraction → Gemini (structured JSON) → DB
   │
   ├── Job search (Server Actions, lib/jobs/)
   │      Provider(s) → normalize/dedupe → jobs table (service-role ingestion)
   │      → Gemini skill analysis (cached) → deterministic match scoring
   │
   └── /api/chat (Route Handler, NDJSON response — see below)
          │
          ▼
     Career Agent (lib/ai/career-agent.ts)
          │
          ├── career profile context (lib/career-profile/)
          ├── resume context (lib/resume/get-resume-context.ts)
          ├── job search results, when this message asks for jobs (lib/jobs/)
          │
          ▼
     Gemini (streamed)
          │
          ▼
     NDJSON events → browser, appended as text or rendered as job cards
```

Next.js remains the only backend — Supabase and Gemini are accessed from
Server Components, Server Actions, and Route Handlers, never called
directly from the browser with privileged credentials.

## Authentication

- `proxy.ts` (Next.js 16's replacement for `middleware.ts`) runs on every
  request: refreshes the Supabase session via
  `lib/supabase/middleware.ts#updateSupabaseSession`, then redirects
  unauthenticated requests to protected paths (`/chat`, `/profile`,
  `/resume`, `/jobs`, `/application`, `/portfolio`, `/github`,
  `/linkedin`, `/interview`, `/career`, `/applications`, `/analytics`,
  `/notifications`) to `/login?next=<path>`, and redirects
  already-authenticated requests away from `/login`/`/signup`.
- Each protected page **also** re-verifies server-side via
  `lib/auth/require-user.ts#requireUser` — Next's own docs explicitly warn
  against relying on proxy/middleware alone, since a matcher change could
  silently remove coverage.
- Auth state (`getClaims()`) is derived from a verified JWT, never trusted
  from client input. See `docs/DATABASE.md` for the RLS design that backs
  this up at the database layer.

## /api/chat's NDJSON protocol

The chat endpoint's response body is one JSON object per line (not plain
text) — `{"type":"jobs","jobs":[...]}` optionally first, then one or more
`{"type":"text","content":"..."}` chunks, or a `{"type":"error",...}` if
the stream is interrupted. `lib/ai/chat-client.ts#streamChatReply` parses
this (buffering across chunk boundaries — a line isn't guaranteed to
arrive in one `read()`) and yields typed events; `ChatWindow.tsx` renders
`"jobs"` events as inline `JobResultsMessage` cards and appends `"text"`
events to the growing assistant message. This is a deliberately minimal
extension of the plain-text protocol from Phase 4, not a move to SSE.

## Directory layout

```text
app/
  page.tsx            Landing page (Server Component — reads auth state)
  chat/               Real chat UI (Gemini-backed, protected) — fresh conversation
  chat/[id]/           Loads and continues a persisted conversation (protected)
  login/, signup/     Auth pages
  profile/            Career profile dashboard incl. resume list (protected)
  profile/setup/      Step-based onboarding wizard (protected)
  resume/[id]/         Resume review page (protected)
  jobs/               Job search page (protected)
  jobs/[id]/           Job detail + match analysis page (protected)
  jobs/saved/          Saved jobs (protected)
  application/[jobId]/ Application Optimization Dashboard — CV tailoring +
                        cover letter generation (protected)
  portfolio/           Portfolio Intelligence dashboard (protected)
  github/               GitHub Intelligence dashboard (protected)
  linkedin/             LinkedIn Optimization dashboard (protected)
  interview/            Interview Coach — session list + start (protected)
  interview/[sessionId]/ Mock interview Q&A flow + summary (protected)
  career/               Career Insights dashboard + Next-Best-Action (protected)
  career/skills/         Skill Gap Intelligence (protected)
  career/roadmap/         Personalized Learning Roadmap (protected)
  applications/           Application Tracking board (protected)
  applications/[id]/       Application detail — status, history, documents (protected)
  analytics/               Career Analytics dashboard (protected)
  notifications/           Notification center (protected)
  auth/callback/       Exchanges email-confirmation code for a session
  api/chat/            NDJSON endpoint that streams the career agent's reply
  api/v1/              Versioned, non-streaming REST API — bearer-token
                        authenticated, meant to sit behind WSO2 API
                        Manager (see docs/WSO2_API.md). 22 route files;
                        health/profile/resumes/jobs/applications/ai/
                        interview.
components/
  ui/                 Reusable, generic UI primitives
  landing/            Landing-page sections
  chat/               Chat-interface-specific components
  auth/               LoginForm, SignupForm, LogoutButton
  profile/            Onboarding wizard + profile dashboard sections
  resume/             Uploader, resume list/card, score, analysis sections
  jobs/               JobCard, JobResultList, JobSearchPage — shared between /jobs and chat
  application/         Skill/keyword comparison, tailored CV + cover letter
                        preview, version history
  portfolio/           Score/findings display, content-draft generator
  github/               Score/findings display, project recommendations
  linkedin/             Score/findings display, headline/about draft generator
  interview/            Session start, mock-interview Q&A flow, history
  career/               Career readiness panel, next-best-action, skill gap
                        dashboard, roadmap dashboard
  applications/          Applications board, detail panel, track-application button
  analytics/              Analytics dashboard
  notifications/          Notification bell, list, upcoming widget
lib/
  ai/                 Gemini abstraction layer (see AI_AGENT.md)
  auth/               Server-side auth guards + friendly error mapping
  career-profile/     Profile data layer: fetch, mutate, AI context, completion score
  resume/             CV upload/processing/analysis (see AI_AGENT.md)
  jobs/               Discovery, matching, chat integration (see AI_AGENT.md, JOB_DATA.md)
  application/         Deterministic resume-vs-job comparison, CV tailoring +
                        cover letter generation (see AI_AGENT.md, DATABASE.md)
  portfolio/           URL fetch + extraction, deterministic scoring, Gemini
                        findings, VerifiedFacts-grounded content generation
  github/               Public GitHub REST API client, deterministic scoring
  linkedin/             Pasted-content analysis (no fetching), scoring, content generation
  interview/            Question generation, answer evaluation, session state
  career/               Cross-domain readiness aggregation + next-best-action +
                        market skill demand + skill-gap priority + live insights
  applications/          Application CRUD/status history, statistics, source/
                        resume performance, analytics summary (see AI_AGENT.md, DATABASE.md)
  learning/              Deterministic roadmap step-building, curated resource
                        catalog, Gemini narration-only generation (see AI_AGENT.md)
  notifications/          Reminder computation/reconciliation, deterministic
                        date parsing, chat reminder-intent extraction (see AI_AGENT.md)
  chat/                  Conversation/message persistence, deterministic title
                        generation (see AI_AGENT.md, DATABASE.md)
  agent-state/            Conversational job-search state: schema, Gemini
                        extraction, deterministic merge/reference-resolution/
                        search-criteria/filtering (see AI_AGENT.md, DATABASE.md)
  api/                    Shared /api/v1 infrastructure: bearer-token auth,
                        response envelope, safe request logging, the
                        career-analysis Gemini call (see WSO2_API.md)
                        (see DATABASE.md, AI_AGENT.md for all of the above)
  supabase/           Supabase clients (browser, server, admin, middleware) + types
  env.ts              Server-side environment variable validation
supabase/migrations/   SQL migrations (source of truth for the schema)
docs/                 Project specification and architecture docs
```

## Supabase client pattern

- `lib/supabase/client.ts` — browser client (`@supabase/ssr`, anon key).
  Safe to import from Client Components.
- `lib/supabase/server.ts` — cookie-aware server client (`@supabase/ssr`,
  anon key), RLS-scoped to the current session. Used for all ordinary
  profile/resume/job-match CRUD.
- `lib/supabase/admin.ts` — service-role client. Bypasses RLS. Guarded by
  `server-only`. As of Phase 7, used in exactly one place
  (`lib/jobs/discovery.ts`) to write to the global `jobs`/`job_skills`
  tables, which have no client-writable RLS policy at all.
- `lib/supabase/middleware.ts` — session-refresh helper for `proxy.ts`.
- `lib/api/auth.ts#authenticateApiRequest` — a fourth pattern, added for
  `/api/v1`: a bearer-token-authenticated client (anon key + the caller's
  own Supabase user JWT sent as `Authorization: Bearer`, not a cookie).
  Every query through it is RLS-scoped to that user exactly like
  `server.ts`'s cookie-based client — the only difference is how the
  session is carried, since a non-browser API client can't rely on
  cookies. See [`WSO2_API.md`](WSO2_API.md).

See [`DATABASE.md`](DATABASE.md) for the schema and RLS design,
[`AI_AGENT.md`](AI_AGENT.md) for how profile/resume/job data reaches
Gemini, and [`JOB_DATA.md`](JOB_DATA.md) for the job provider architecture.
