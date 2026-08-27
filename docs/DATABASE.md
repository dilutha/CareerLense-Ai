# Database

Status: **schema written, none of the four migrations applied yet.**
Re-verified directly against the live project as of Phase 8 (`GET
/rest/v1/profiles` and all Phase 8 tables → `PGRST205: Could not find the
table 'public.<table>'`, differentiated from a `401` returned for a
deliberately invalid key, so this reflects the real project, not an auth
failure) — migration 001 still hasn't been run, so 002, 003, and 004
(which all depend on `profiles`, and 004 additionally on `resumes` and
`jobs`) can't be either. **Nothing in Phase 5, 6, 7, or 8's database layer
works until all four are applied.** Auth (signup/login) is unaffected —
it uses Supabase's built-in `auth.users`, independent of these migrations.

Apply all four, in order, via the Supabase SQL Editor or `supabase db push`:

1. [`001_initial_career_profile.sql`](../supabase/migrations/001_initial_career_profile.sql)
2. [`002_resume_intelligence.sql`](../supabase/migrations/002_resume_intelligence.sql)
3. [`003_job_discovery.sql`](../supabase/migrations/003_job_discovery.sql)
4. [`004_job_application_tailoring.sql`](../supabase/migrations/004_job_application_tailoring.sql)

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

## Planned for later phases (not yet created)

```text
applications                          application tracking phase
portfolio_analyses                    portfolio review phase
conversations / messages              whenever chat persistence is added
interview_sessions / questions / answers   interview agent phase
```
