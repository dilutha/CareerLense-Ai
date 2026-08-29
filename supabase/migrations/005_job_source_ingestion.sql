-- CareerLens AI — Phase 9: multi-source job discovery + application tracking.
--
-- Depends on migrations 001-004 (profiles, resumes, jobs/job_skills,
-- application_documents). Does not modify or drop anything from them —
-- purely additive: new columns on jobs/saved_jobs/application_documents,
-- plus two new global tables for source observability.
--
-- Apply via the Supabase CLI (`supabase db push --linked`) or the SQL Editor.

-- ---------------------------------------------------------------------------
-- jobs: freshness + cross-source provenance. A vacancy discovered again on
-- a later search updates last_seen_at (see lib/jobs/discovery.ts) but
-- keeps its original first_seen_at. listing_status defaults to 'unknown'
-- rather than 'active' for EXISTING rows (there are none yet on this
-- project, but the principle holds for future re-runs of this migration
-- pattern elsewhere) since we haven't actually re-checked them; new rows
-- inserted going forward default to 'active' at the application layer.
-- duplicate_of links a source-specific row to the canonical row for the
-- same real-world vacancy when the cross-source deduplicator is confident
-- enough to say so (lib/jobs/cross-source-dedupe.ts) — the duplicate row
-- is kept, never deleted, so source provenance is never lost.
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column source_name text,
  add column first_seen_at timestamptz not null default now(),
  add column last_seen_at timestamptz not null default now(),
  add column listing_status text not null default 'unknown'
    check (listing_status in ('active', 'stale', 'closed', 'unknown')),
  add column duplicate_of uuid references public.jobs (id) on delete set null;

create index jobs_duplicate_of_idx on public.jobs (duplicate_of);
create index jobs_last_seen_at_idx on public.jobs (last_seen_at);

comment on column public.jobs.duplicate_of is
  'Set when this row is confidently the same real-world vacancy as another (different) source''s row — points at the canonical row. Never deleted; preserves per-source provenance. NULL means this row is canonical (or has no known duplicate).';

-- ---------------------------------------------------------------------------
-- saved_jobs: lightweight application-tracking status. Deliberately kept
-- on saved_jobs (not a new `applications` table, and not on
-- application_documents) because "saved" is the natural starting point of
-- this lifecycle and doesn't require a resume/tailoring to exist yet —
-- see docs/DATABASE.md for the full rationale on why this wasn't a new
-- table. application_documents (migration 004) already tracks the
-- CV-tailoring-specific workflow state once that begins; this tracks the
-- user's real-world application progress, which is a different axis.
-- ---------------------------------------------------------------------------

alter table public.saved_jobs
  add column status text not null default 'saved'
    check (status in ('saved', 'preparing', 'ready_to_apply', 'applied', 'interview', 'rejected', 'offer')),
  add column notes text,
  add column applied_at timestamptz;

-- ---------------------------------------------------------------------------
-- job_sources: static-ish registry of every discovery source, updated by
-- trusted server code after each real ingestion run (never client-writable
-- — same posture as jobs/job_skills). Lets the UI/docs report genuine
-- "last checked" status instead of a hardcoded claim. Global, not
-- user-owned.
-- ---------------------------------------------------------------------------

create table public.job_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  region text not null,
  access_method text not null
    check (access_method in ('api', 'structured_data', 'user_supplied', 'manual_external', 'fixture')),
  status text not null default 'unavailable'
    check (status in ('available', 'unavailable', 'rate_limited', 'blocked', 'configuration_required', 'error')),
  enabled boolean not null default true,
  last_successful_run_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger job_sources_set_updated_at before update on public.job_sources
  for each row execute function public.set_updated_at();

comment on table public.job_sources is
  'Registry of every job source CareerLens knows about (not just currently active ones) — see lib/jobs/providers/registry.ts for the code-level source of truth this mirrors at runtime.';

-- Seed one row per source in lib/jobs/providers/registry.ts's
-- SOURCE_REGISTRY, so discovery.ts can UPDATE (not upsert) a source's live
-- status after each real run without needing to know each source's static
-- metadata. Sources that are never automatically queried (linkedin,
-- xpressjobs, ikman) simply keep this seeded status forever, which is
-- correct — they're genuinely never run.
insert into public.job_sources (key, name, region, access_method, status, enabled) values
  ('itpro', 'ITPro.lk', 'Sri Lanka', 'api', 'available', true),
  ('company-careers', 'Company Careers', 'Sri Lanka / Global', 'structured_data', 'configuration_required', true),
  ('xpressjobs', 'XpressJobs', 'Sri Lanka', 'manual_external', 'unavailable', false),
  ('ikman', 'ikman.lk Jobs', 'Sri Lanka', 'manual_external', 'unavailable', false),
  ('linkedin', 'LinkedIn', 'Global', 'manual_external', 'blocked', false),
  ('worldwide', 'Worldwide Job APIs', 'Global', 'api', 'configuration_required', true),
  ('demo', 'Demo Data', 'N/A', 'fixture', 'available', true);

-- ---------------------------------------------------------------------------
-- job_source_runs: one row per discovery attempt against one source —
-- pure observability, no sensitive data (never stores raw resume/profile
-- content, only aggregate counts and a short error summary).
-- ---------------------------------------------------------------------------

create table public.job_source_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.job_sources (key) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'success' check (status in ('success', 'partial', 'failed')),
  jobs_found integer not null default 0 check (jobs_found >= 0),
  jobs_added integer not null default 0 check (jobs_added >= 0),
  jobs_updated integer not null default 0 check (jobs_updated >= 0),
  jobs_failed integer not null default 0 check (jobs_failed >= 0),
  error_summary text
);

create index job_source_runs_source_key_idx on public.job_source_runs (source_key);
create index job_source_runs_started_at_idx on public.job_source_runs (started_at);

-- ---------------------------------------------------------------------------
-- application_documents: extend Phase 8's per-(profile,job) row with a
-- real-world application status lifecycle, once the user has actually
-- started preparing an application for a job (i.e. once this row exists).
-- Distinct from this table's existing `status` column (draft/ready —
-- whether a tailored CV exists yet); application_status tracks what
-- happens after that, in the real world.
-- ---------------------------------------------------------------------------

alter table public.application_documents
  add column application_status text not null default 'preparing'
    check (application_status in ('preparing', 'ready_to_apply', 'applied', 'interview', 'rejected', 'offer')),
  add column notes text,
  add column applied_at timestamptz;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.job_sources enable row level security;
alter table public.job_source_runs enable row level security;

-- Global observability data, same posture as jobs/job_skills: readable by
-- any authenticated user, no client write policy at all (service-role
-- ingestion code only).
create policy "job_sources_select_authenticated" on public.job_sources
  for select to authenticated using (true);
create policy "job_source_runs_select_authenticated" on public.job_source_runs
  for select to authenticated using (true);

-- No new RLS needed for jobs/saved_jobs/application_documents — the new
-- columns are covered by each table's existing row-level policies from
-- migrations 003/004 (policies apply per-row, not per-column).
