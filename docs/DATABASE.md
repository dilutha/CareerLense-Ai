# Database

Status: migrations 001-007 are applied to the live Supabase project,
verified directly (`supabase migration list --linked` shows 001-007
applied both locally and remotely; every expected table, column, RLS
policy, constraint, trigger, and index was independently queried and
confirmed present via `supabase db query --linked`, not inferred from the
push command's success message alone). Migrations 010 (chat persistence),
011 (agent state), and 012 (profile source tracking) are also applied and
live-verified — see their sections below.

The WSO2 API Manager integration (`/api/v1`, see
[`WSO2_API.md`](WSO2_API.md)) required **no new migration** — every
endpoint reads/writes the existing schema through the existing RLS
policies, just via a bearer-token-authenticated client instead of a
cookie-based one (`lib/api/auth.ts`). No new tables, columns, or
policies exist for the API layer.

Apply all twelve, in order, via `supabase db push --linked` (uses the
Supabase CLI's Management API path — no database password needed once the
project is linked) or the SQL Editor:

1. [`001_initial_career_profile.sql`](../supabase/migrations/001_initial_career_profile.sql)
2. [`002_resume_intelligence.sql`](../supabase/migrations/002_resume_intelligence.sql)
3. [`003_job_discovery.sql`](../supabase/migrations/003_job_discovery.sql)
4. [`004_job_application_tailoring.sql`](../supabase/migrations/004_job_application_tailoring.sql)
5. [`005_job_source_ingestion.sql`](../supabase/migrations/005_job_source_ingestion.sql)
6. [`006_career_intelligence.sql`](../supabase/migrations/006_career_intelligence.sql)
7. [`007_job_source_expansion.sql`](../supabase/migrations/007_job_source_expansion.sql)
8. [`008_career_tracking.sql`](../supabase/migrations/008_career_tracking.sql)
9. [`009_notifications.sql`](../supabase/migrations/009_notifications.sql)
10. [`010_chat_persistence.sql`](../supabase/migrations/010_chat_persistence.sql)
11. [`011_agent_state.sql`](../supabase/migrations/011_agent_state.sql)
12. [`012_profile_source_tracking.sql`](../supabase/migrations/012_profile_source_tracking.sql)

## Platform

- **Database:** Supabase PostgreSQL
- **Authentication:** Supabase Auth (email/password)
- **File storage:** Supabase Storage — private `resumes` bucket (Phase 6)
- **Realtime:** Supabase Realtime — not used yet

We are not introducing Prisma. Supabase's PostgreSQL is accessed directly
via SQL migrations (`supabase/migrations/`) and the Supabase JS client.

## Client setup (`lib/supabase/`)

- `client.ts` — browser client (`createBrowserClient` from `@supabase/ssr`,
  anon key). Session is stored in cookies so server-rendered requests can
  read it. Safe to import from Client Components.
- `server.ts` — cookie-aware server client (`createServerClient`, anon
  key) for Server Components, Server Actions, and Route Handlers. Every
  query runs as the current session — RLS is the only thing enforcing
  authorization, never application code. Resume upload/processing also
  runs through this client (not the service role) — see below.
- `admin.ts` — service-role client. Bypasses RLS entirely. As of Phase 7,
  used in exactly one place: `lib/jobs/discovery.ts`, to write to the
  global `jobs`/`job_skills` tables (which have no client-writable RLS
  policy at all — see `DATABASE.md`'s Phase 7 section). Guarded by
  `server-only`.
- `middleware.ts` — `updateSupabaseSession()`, called from the root
  `proxy.ts` on every request to refresh the session and return verified
  JWT claims.
- `types.ts` — hand-authored types matching migration 001. **Not** passed
  as the generic parameter to the Supabase clients — it doesn't match the
  exact structural contract supabase-js's generics expect (relationship
  metadata, internal version markers), so query results are typed
  explicitly at the point of use instead (`lib/career-profile/`,
  `lib/resume/`, `lib/jobs/`). Regenerate this file for real once all
  three migrations are applied:

  ```bash
  supabase gen types typescript --project-id <project-id> > lib/supabase/types.ts
  ```

## Schema (Phase 5) — career profile

One profile per authenticated user (`profiles.id = auth.users.id`), plus
the relational tables that make up a career profile:

```text
profiles            one row per user — name, headline, bio, location, links
skills               shared/global lookup table (not user-owned)
profile_skills       many-to-many: profiles <-> skills, with proficiency
education            multiple rows per profile
experience            multiple rows per profile
projects              multiple rows per profile
career_preferences   one row per profile — target role, locations, etc.
```

### Automatic profile creation

A `SECURITY DEFINER` trigger (`handle_new_user`) fires `AFTER INSERT ON
auth.users` and creates a matching `profiles` row, pulling `full_name` from
the signup metadata. `ON CONFLICT (id) DO NOTHING` makes it idempotent.

### RLS

Enabled on every table. `profiles` and its child tables restrict every
operation to rows where `auth.uid()` matches — either `profiles.id`
directly, or `profile_id` on child tables (which, by construction, equals
the owning user's auth uid, so no join back to `profiles` is needed).
`skills` is the one shared table: any authenticated user can read all
skills or add a new one, but no one can update/delete existing entries via
the client.

## Schema (Phase 6) — resume intelligence

A resume is deliberately **not** the same thing as the career profile — it's
a specific uploaded document with its own extracted content and AI
evaluation, never auto-merged into `profiles`/`skills`/etc.:

```text
resumes             one row per uploaded CV — filename, storage path,
                     file type/size, status (uploaded/processing/ready/failed)
resume_versions      extracted text + parsed structured data (JSONB) for one
                     resume; multiple rows per resume later (tailored copies)
resume_analysis      CareerLens's evaluation of one resume_version — score,
                     strengths/weaknesses, detected skills, suggestions
```

### RLS

`resumes.profile_id` follows the same direct-comparison pattern as
Phase 5's child tables. `resume_versions` and `resume_analysis` don't carry
`profile_id` themselves, so their policies walk back up via `EXISTS`:
`resume_analysis → resume_versions → resumes → profile_id = auth.uid()`.

### Storage

A private `resumes` bucket (created by the migration itself via `insert
into storage.buckets`). Object paths are `{user_id}/{resume_id}/{filename}`
*within* the bucket. Storage RLS policies on `storage.objects` restrict
select/insert/update/delete to objects whose first path segment
(`storage.foldername(name)[1]`) matches `auth.uid()`. The bucket is never
public and no permanent public URL is generated — "view original CV" uses
a 60-second signed URL created server-side per request
(`lib/resume/actions.ts#getResumeSignedUrl`).

### Deterministic scoring

`resume_analysis.overall_score` and `.score_breakdown` are **not** trusted
directly from Gemini. Gemini returns *findings* (a label, a category, an
explanation, and a ±impact); `lib/resume/analyze-resume.ts` computes each
category's score as a fixed base (75) plus the sum of that category's
impacts, clamped to [0, 100], and the overall score as their average — see
that file for the full rationale.

## Schema (Phase 7) — job discovery + matching

```text
jobs             shared/global — every authenticated user can read, but
                 write access is server-only (service-role client, trusted
                 ingestion code in lib/jobs/discovery.ts) — no client-side
                 INSERT/UPDATE/DELETE policy exists at all
job_skills        shared/global — same write posture as jobs; per-job
                 skills extracted once by Gemini, required/preferred/
                 nice_to_have distinguished
job_matches       user-owned — cached, per-(profile_id, job_id) deterministic
                 match score (see Deterministic matching below); never a
                 universal score
saved_jobs        user-owned — a user's bookmarked jobs
```

### RLS

`jobs`/`job_skills`: `SELECT` for any authenticated user, no write
policies at all — see [`JOB_DATA.md`](JOB_DATA.md) for why ingestion must
go through the admin client instead. `job_matches`/`saved_jobs`: the
standard `profile_id = auth.uid()` pattern from Phase 5/6, on all four
operations (a user computes and writes their *own* match record via the
ordinary RLS-scoped client — no elevated privilege needed for that part).

### Deterministic matching

`job_matches.match_score` (and its six-category breakdown: skills, role,
experience, education, location, keywords) is **never** asked of Gemini
directly. `lib/jobs/match.ts#computeJobMatch()` combines: exact + alias-
aware skill matching (`lib/jobs/skill-aliases.ts`), a small controlled
role taxonomy (`lib/jobs/role-taxonomy.ts`), and explicit rules for
experience (never zero, and internships/entry-level roles never penalize
a candidate for lacking professional experience), education, location,
and keyword overlap — weighted per `lib/jobs/config.ts#JOB_MATCH_WEIGHTS`
(skills 35%, role 20%, experience 15%, education 10%, location 10%,
keywords 10%). Gemini's role in this pipeline is limited to one-time job
analysis (extracting skills/requirements — see `JOB_DATA.md`) and, on
request, narrating an already-computed score in friendly prose
(`lib/jobs/actions.ts#explainJobMatch`) — it never sets the number itself.

## Career + resume + job context → Gemini

`lib/career-profile/profile-context.ts`,
`lib/resume/get-resume-context.ts`, and `lib/jobs/summary.ts#buildJobResultsContext`
each compress their domain's data into a short text block, appended
together to the Gemini system instruction in `lib/ai/career-agent.ts`. The
model never receives raw database rows, never receives the full extracted
resume text on every chat message, and never receives more than a handful
of job results per turn — only compact summaries. See
[`AI_AGENT.md`](AI_AGENT.md).

## Schema (Phase 8) — job application tailoring

Job-level analysis (skills/requirements/keywords) already lives in
`jobs`/`job_skills` from migration 003 and is reused here, not duplicated:

```text
application_documents           one row per (profile_id, job_id) — links a
                                 job to the resume being tailored for it,
                                 status draft/ready
application_analyses            one row per application_document — the
                                 deterministic skill/keyword comparison
                                 (JSONB) and overall keyword alignment %
application_document_versions   append-only tailored-CV versions (JSONB
                                 content + before/after tailoring notes);
                                 the original resume/resume_versions rows
                                 are never modified
cover_letters                   append-only tailored cover-letter versions
                                 (plain text), same versioning shape as
                                 application_document_versions
```

### RLS

All four tables carry a denormalized `profile_id` (rather than requiring
an `EXISTS` join back through `application_documents`), scoped to
`profile_id = auth.uid()` — consistent with most of the project's other
user-owned tables. `application_document_versions` and `cover_letters`
intentionally have no `UPDATE` policy: both are append-only version
history, so the only way to add a version is `INSERT`.

### Truthfulness

Neither the tailored CV nor the cover letter is generated from open-ended
Gemini reasoning about the candidate. `lib/application/verified-facts.ts`
builds a closed `VerifiedFacts` object strictly from the user's own career
profile + selected resume version, and the tailoring/cover-letter prompts
(`lib/application/prompts.ts`) explicitly forbid introducing any skill,
employer, project, or credential outside that set. The skill/keyword
*comparison* itself (`lib/application/compare.ts`) is fully deterministic,
not Gemini — a required skill is `strong_match`/`match` only if the
candidate's own data contains it (via `lib/jobs/skill-aliases.ts`'s
canonicalization), `partial` only via a small curated related-skill list
(`lib/application/related-skills.ts`, e.g. Power BI for a Tableau
requirement), and otherwise `missing`.

## Schema (Phase 9) — multi-source discovery + application tracking

Purely additive — new columns on existing tables plus two new global
tables. Nothing from migrations 001-004 was modified.

```text
jobs                 + source_name, first_seen_at, last_seen_at,
                        listing_status (active/stale/closed/unknown),
                        duplicate_of (cross-source dedup link)
saved_jobs            + status (saved/preparing/ready_to_apply/applied/
                        interview/rejected/offer), notes, applied_at
application_documents + application_status (same 6 values minus "saved" —
                        that's saved_jobs' job), notes, applied_at
job_sources           global registry of every discovery source — mirrors
                       lib/jobs/providers/registry.ts, updated with real
                       last_successful_run_at/last_error after each search
job_source_runs       one row per discovery attempt per source — pure
                       observability (counts + a short error summary),
                       never sensitive data
```

### Why status lives on two different tables

`saved_jobs.status` and `application_documents.application_status` track
different things, not the same concept duplicated: `saved_jobs` exists the
moment a user bookmarks a job (no resume needed yet) — "saved" is its
natural default. `application_documents` (Phase 8) only exists once a user
has picked a resume and started tailoring, so "preparing" is *its* natural
default; it also already carries `source_resume_id`, matching the "which
CV did I apply with" question a real application-tracking record needs.
Putting the richer lifecycle on `application_documents` instead of
creating a third `applications` table avoids duplicating profile_id/job_id
/resume_id/timestamps that table already has — see `PROJECT_SPEC.md`'s
Phase 9 entry for the full reasoning.

### Cross-source deduplication

`jobs.duplicate_of` (nullable, FK to `jobs.id`) links a row to another
source's row for the same real-world vacancy, set by
`lib/jobs/cross-source-dedupe.ts` after storage — conservative (exact
`application_url` match, or agreement on ALL of normalized company +
title + location) and never deletes either row, so every source's
provenance is preserved. See `JOB_DATA.md` for the full matching rules.

### RLS

`job_sources`/`job_source_runs`: same posture as `jobs`/`job_skills` —
`SELECT` for any authenticated user, no client write policy at all
(service-role ingestion only). No new RLS was needed for the columns added
to `jobs`/`saved_jobs`/`application_documents` — existing row-level
policies from migrations 003/004 apply per-row, not per-column.

## Schema (Phase 10) — career intelligence

Seven new tables, all user-owned. Deliberately does NOT include separate
`portfolio_profiles`/`github_profiles`/`linkedin_profiles` tables (the
URL/username/pasted-content each analysis ran against is stored directly
on that analysis row) or a `career_readiness_snapshots` table (readiness
is computed live from the latest row in each `*_analyses` table — see
below — rather than persisted, since it would just duplicate data that's
already here and go stale).

```text
portfolio_analyses            append-only — one row per analysis run
                               (like resume_versions). url, content_hash,
                               category_scores (deterministic, see below),
                               overall_score, findings (jsonb)
portfolio_generated_content    append-only — hero/about/project/skills/
                               summary/cta drafts, grounded in VerifiedFacts
github_analyses                append-only — github_username, content_hash
                               over the fetched public repo list,
                               category_scores, overall_score, findings,
                               recommended_projects
linkedin_analyses               append-only — content_hash over
                               user-PASTED text (never fetched/scraped),
                               category_scores, overall_score, findings
linkedin_generated_content      append-only — headline (3 options)/about/
                               skills drafts, grounded in VerifiedFacts
interview_sessions              one row per mock interview run, optionally
                               tied to a job_id; status in_progress/completed
interview_exchanges             one row per question — created with the
                               question, updated in place with the
                               answer/feedback/quality_score once answered
                               (not append-only — one row IS the Q+A turn)
```

### Deterministic scoring — same philosophy as resume_analysis (Phase 6)

Gemini never sets a score directly. For portfolio/GitHub/LinkedIn, Gemini
returns findings (`label`, `category`, `severity`, `impact -15..+15`,
`explanation`); `lib/{portfolio,github,linkedin}/score.ts` compute each
category as `clamp(75 + Σimpact, 0, 100)`, then a WEIGHTED sum across
categories (not a flat average — see each domain's `*_CATEGORY_WEIGHTS`):

- Portfolio: career_positioning 20%, projects 25%, technical_evidence 20%,
  content_quality 15%, recruiter_readability 10%, seo 10%.
- GitHub: career_relevance 30%, repository_quality 25%, documentation 20%,
  profile_completeness 15%, activity 10%.
- LinkedIn: about 30%, headline 25%, skills_experience 25%, positioning 20%.
- Interview answers: an "Answer Quality Score"
  (`lib/interview/score.ts`) — relevance 25%, technical_accuracy 25%,
  structure 20%, clarity 20%, conciseness 10%. Deliberately has **no**
  "confidence" dimension — text alone can't reliably measure human
  confidence, and the project rules forbid pretending it can.

### Career readiness — computed live, not stored

`lib/career/readiness.ts#computeCareerReadiness` — a weighted average
(CV 20%, Portfolio 20%, Skills 20%, Projects 15%, LinkedIn 10%, GitHub
10%, Interview 5%) over whatever's actually been analyzed. A component
with no data is EXCLUDED and the remaining weights renormalized — never
defaulted to 0 (verified by a direct test reproducing PROJECT_SPEC's own
acceptance example: CV=85/Portfolio=65/GitHub=82/Skills=88/LinkedIn=70,
Projects/Interview not analyzed → overall 79%, Portfolio correctly
identified as the primary weakness by `lib/career/next-best-action.ts`).
"Skills" reuses `job_matches.skills_score` (already deterministic,
Phase 7) rather than inventing a new heuristic; "Projects" reuses
portfolio_analyses' own "projects" category score rather than duplicating
it in a new column.

### RLS

All seven tables: standard `profile_id = auth.uid()` pattern. The
append-only analysis/content tables have `select`/`insert`/`delete`
policies only (no `update` — a new analysis is a new row, matching
resume_versions/application_document_versions). `interview_sessions`/
`interview_exchanges` additionally have `update` (status transitions,
recording an answer once submitted).

## Schema (Phase 10A) — job source expansion

Minimal, purely additive: one new column, one data-only rename. No new
tables — see below for why.

```text
jobs.source_type    text, default 'job_board', check in
                     ('job_board', 'aggregator_result', 'official_company', 'fixture').
                     Set explicitly by every provider (never left to the
                     default in practice — see lib/jobs/schemas.ts).
                     Drives the deterministic source-confidence label
                     (lib/jobs/source-confidence.ts) — never a fabricated score.
```

`job_sources` (migration 005): the `worldwide` row (a generic placeholder
for "some future permitted search API") is renamed in place to `serpapi`
via `UPDATE ... WHERE key = 'worldwide'`, not a new INSERT — now that a
concrete implementation exists, keeping both would just be a duplicate,
unused row. Safe because no `job_source_runs` row had ever referenced
`worldwide` (no worldwide-search credential was ever configured before
this phase).

### Why no new `job_sources`-per-job junction table

The Phase 10A brief raised the question of whether one table listing
every source a given vacancy appears under is needed. It isn't: migration
005's `jobs.duplicate_of` mechanism already does this — the SAME
real-world vacancy discovered via a different source is stored as its OWN
row (preserving that source's `source`/`source_url`/`application_url`
verbatim) and linked to the canonical row via `duplicate_of`, rather than
nested inside one row's data. `getRelatedSourceJobs()` (`lib/jobs/get-jobs.ts`)
already surfaces "Also listed on: X, Y" this way. Adding a second,
overlapping mechanism would violate the project's repeated "do not
duplicate information unnecessarily" rule for no functional gain.

## Schema (Phase 11) — application tracking, skill gaps, learning roadmaps

Four new tables, all user-owned (migration 008).

```text
applications                 one row per (profile_id, job_id) a user is
                              actively tracking — status is one of 11
                              values (saved/interested/preparing/applied/
                              screening/interview/final_round/offer/
                              rejected/withdrawn/closed), plus notes,
                              follow_up_date, applied_at, and a nullable
                              application_document_id (which tailored
                              CV/cover-letter version, once tailoring has
                              happened)
application_status_history   append-only — one row per status change
                              (old_status nullable for the very first
                              row, new_status, changed_at, note). No
                              client update/delete policy at all — same
                              posture as resume_versions/
                              application_document_versions
learning_roadmaps            one row per (profile_id, target_role) —
                              content_hash (skips a Gemini re-narration
                              call when the underlying skill gaps
                              haven't changed), summary
learning_roadmap_items        one row per roadmap step — step_order,
                              skill, resource_type, resource_url
                              (nullable, CHECK ~ '^https://'),
                              resource_note, estimated_duration_text,
                              status (not_started/in_progress/completed)
```

### Why `applications` is a genuinely new table, not a further extension

Phase 9 put a minimal status field on `application_documents` precisely
because, at the time, every tracked application already had a resume
being tailored for it. Phase 11 needs to track a job from the moment a
user is merely "interested" — before any resume has been picked — and
`application_documents.source_resume_id` is `NOT NULL`, so it structurally
cannot represent that state. Rather than relaxing a working table's
constraint (risking every other Phase 8 code path that assumes a resume is
always present), `applications` is new and additive:
`application_document_id` is a nullable FK back to `application_documents`,
populated only once tailoring has actually happened, so "Applied with: CV
Version X" can still be shown without `applications` needing to duplicate
`application_document_versions`' own data.

### Why no `career_insights` table

Career insight cards (`lib/career/insights.ts`) are computed live on every
`/career` render from data that's already fetched for other purposes
(application stats, resume performance, top skill gap) — the same
"compute live, don't persist a stale copy" reasoning Phase 10's career
readiness snapshot already established. Storing them would mean either
re-computing on every write (redundant) or risking a stale card after the
underlying data changes.

### RLS

All four tables: standard `profile_id = auth.uid()` pattern, denormalized
directly onto `application_status_history`/`learning_roadmap_items` (child
tables) for RLS-simplicity consistency with the rest of the project, rather
than requiring an `EXISTS` join back through the parent row.
`application_status_history` has `select`/`insert` policies only — no
`update`/`delete` — enforcing append-only historical integrity at the
database layer, not just in application code.

### Career readiness — an 8th component

`lib/career/readiness.ts`'s weights were rebalanced to make room for
"Applications" (CV 18%, Portfolio 18%, Skills 18%, Projects 12%, LinkedIn
8%, GitHub 8%, Interview 10%, Applications 8% — sums to 100, down
proportionally from Phase 10's CV 20/Portfolio 20/Skills 20/Projects
15/LinkedIn 10/GitHub 10/Interview 5). Its score
(`lib/career/sources/applications-source.ts`) is
`clamp(50 + responseRate / 2, 0, 100)` when at least one application has
been submitted, else `null` (excluded and the remaining weights
renormalized — same "not analyzed ≠ 0" rule as every other component),
documented explicitly as "a simple, documented, deterministic formula...
not a scientifically validated metric."

## Schema (Phase 12) — notifications & reminders

One new column, one new table (migration 009).

```text
applications.interview_at   new nullable timestamptz — the real scheduled
                             interview date/time for a tracked application.
                             Distinct from interview_sessions (Phase 10's
                             mock/practice interviews) — this is a real
                             calendar appointment, not a practice run.
notifications                one row per reminder/alert — type
                             (application_follow_up/interview_reminder/
                             application_deadline/status_change/
                             action_required), title, message,
                             related_application_id, related_job_id,
                             related_status_history_id (status_change
                             only), scheduled_for, read_at, sent_at
```

### Idempotency — enforced at the database layer

- `status_change` notifications are 1:1 with the
  `application_status_history` row that caused them:
  `related_status_history_id` carries a `UNIQUE` constraint, so retrying
  the same status update can only ever produce one notification per
  history row.
- `application_follow_up`/`interview_reminder`/`application_deadline`
  reminders are scheduled at a DETERMINISTIC offset from their source
  date (`lib/notifications/compute-reminders.ts` — 24h and 1h before an
  interview, 2 days before a job's `expires_at`, 9am Colombo on the
  follow-up date). The same source date always produces the same
  `scheduled_for`, so `UNIQUE (profile_id, related_application_id, type,
  scheduled_for)` makes `lib/notifications/sync.ts`'s reconciliation
  logic safe to call repeatedly — a page refresh, a retried Server
  Action, or a future cron tick can never create a duplicate.

### Reminder lifecycle

`lib/notifications/sync.ts#syncApplicationReminders` reconciles the
DESIRED set of reminders (computed fresh from `follow_up_date`,
`interview_at`, and `jobs.expires_at`) against what currently exists,
deleting stale unsent reminders whose source date changed and inserting
new ones — never touching a reminder that's already been surfaced
(`sent_at` set). It's called from `lib/applications/actions.ts` whenever
one of those three source dates could have changed: `trackApplication`,
`setFollowUpDate`, `setInterviewAt`.

### Deadline reminders and `jobs.expires_at`

`application_deadline` reminders read `jobs.expires_at` — real source
data only, per Part 7's "never invent a deadline" rule. As of this phase,
**no job provider (ITPro.lk or SerpApi) actually populates
`jobs.expires_at`** — the column has existed since migration 003 but is
always null in practice, so this reminder type is implemented correctly
but will not currently produce any real deadline reminders until a
provider starts supplying that data (or a user is later given a way to
enter one manually — not built in Phase 12).

### Delivery — no background worker/cron in this deployment

There is no email or push notification, and no background job runner
(Redis/BullMQ/Kafka/etc. were explicitly ruled out — see
`docs/AI_AGENT.md`). A scheduled reminder becomes visible the next time
the signed-in user loads a page that reads notifications (`/notifications`,
the bell on `/career`/`/applications`) at or after its `scheduled_for`
time — `lib/notifications/get-notifications.ts` marks any due-but-unsent
row as sent at that point. `sent_at` is never treated as proof of an
email/push actually being delivered, because none exists.

### Timezone

Sri Lanka has a single fixed UTC+5:30 offset with no daylight saving, so
`lib/notifications/colombo-time.ts` hardcodes that offset rather than
using a timezone library or the `Intl` timezone APIs — every timestamp is
still stored as a real UTC `timestamptz` (existing project convention);
Colombo time is only used for date-phrase arithmetic ("next Monday",
"9am") and display. There is no per-profile timezone field — the whole
product is Sri Lanka-first (`profiles.location` is free text, not a
timezone), so Colombo is the fixed assumption everywhere, documented
rather than left implicit.

### RLS

Standard `profile_id = auth.uid()` pattern, full CRUD (not append-only,
unlike `application_status_history`) — a user legitimately mutates their
own notifications (mark read, and the reconciliation logic deletes/
recreates still-unsent reminders). A notification already surfaced
(`sent_at` set) is treated as immutable by application-code convention,
not a stricter RLS policy — matching how this project already trusts its
own server-side action layer within RLS's boundary elsewhere.

## Schema (UX Refactor) — chat persistence

Two new tables (migration 010) — chat had no persistence at all before
this (`docs/AI_AGENT.md` said so explicitly since Phase 3-4).

```text
conversations    one row per sidebar-visible chat — title,
                 title_is_custom (never silently overwritten by
                 auto-titling once the user renames it), last_message_at
                 (drives sidebar ordering)
messages          append-only — one row per turn (role, content,
                 job_results jsonb for the same job cards already shown
                 inline in the UI, so reloading a conversation matches
                 what was live)
```

Two tables, not one wide row with an embedded array — `messages` follows
this project's established one-row-per-fact pattern (e.g.
`application_status_history`) instead of growing an unbounded JSONB array
on `conversations`. RLS: standard `profile_id = auth.uid()`, full CRUD on
`conversations` (rename/delete), select+insert only on `messages` (a
message is never edited or individually deleted — deleting the whole
conversation, which cascades, is the only way to remove one).

A conversation row is created lazily, server-side, the moment its first
real message is saved (`lib/chat/persist.ts`) — clicking "New Chat" in
the UI never creates an empty, abandoned row on its own.

## Schema (Phase 21) — conversational job refinement / agent state

One new column (migration 011): `conversations.agent_state jsonb not
null default '{}'::jsonb`.

### Why a column on `conversations`, not a new table

The state is genuinely 1:1 with its conversation — a whole-object
overwrite every turn, never a growing history (the history that already
exists is in the `messages` table). A separate `conversation_state` table
would only add a join for no benefit, the same reasoning already used for
single-value additions elsewhere in this project (e.g.
`applications.interview_at` rather than a new table). RLS is already
correctly scoped on `conversations` itself (migration 010's
`profile_id = auth.uid()` policies) — no new policy was needed, since
this is just more data on an already-protected row.

### Validation

The database does not enforce the JSONB's internal shape — it's validated
at the application layer by `lib/agent-state/schema.ts`'s
`CareerAgentStateSchema` (Zod) on every read (`getAgentState` falls back
to an empty state on any validation failure, e.g. a future incompatible
shape change, rather than throwing) and every write (only ever written
via `mergeAgentState`'s output, itself built from a schema-validated
Gemini extraction). See `docs/AI_AGENT.md` for the full extraction/merge
pipeline.

## Schema (Usability overhaul) — profile source tracking

One new column on each of `education`, `experience`, `projects`,
`profile_skills` (migration 012): `source text not null default 'manual'
check (source in ('manual','cv','portfolio','github','chat'))`.

### Why

The onboarding redesign auto-populates the profile from an uploaded CV
(`lib/career-profile/populate-from-resume.ts#populateProfileFromResume`,
called from `processResumeCore`) and from GitHub's public repo languages
(`populateProfileFromSkillsAndProjects`, called from `analyzeGitHub`) —
closing the previous gap where resume/GitHub analysis stayed siloed from
the actual career-profile tables. `source` is how the UI (and a future
prompt) can distinguish "you told me this" from "I found this on your
CV/GitHub" without guessing. Portfolio analysis (`lib/portfolio/`) does
**not** currently populate the profile — its Gemini output is an SEO/
positioning critique with no structured skills/projects list, and adding
one would mean a second Gemini call purely to manufacture data this
schema change doesn't otherwise require; `source='portfolio'` exists in
the check constraint for when that extraction is eventually built, not
because anything writes it yet.

### Merge semantics

Additive-only — `populateProfileFromResume`/`populateProfileFromSkillsAndProjects`
look up existing rows (case-insensitive on the fields that identify an
entry: institution+degree, company+role, project/skill name) and only
insert what's missing. Nothing already in the table (manual or
otherwise) is ever updated or overwritten.

### RLS

None needed — `education`/`experience`/`projects`/`profile_skills` are
already owner-scoped (migration 001's `profile_id = auth.uid()`
policies); an added column doesn't change who can read/write a row.

## Planned for later phases (not yet created)

```text
email / push notifications            a real production extension on top
                                       of Phase 12's in-app notifications —
                                       see docs/AI_AGENT.md's delivery-
                                       architecture note
```
