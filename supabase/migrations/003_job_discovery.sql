-- CareerLens AI — Phase 7: job discovery + matching.
--
-- Adds jobs (a shared/global table — normal users can read but never
-- write it, only trusted server-side ingestion using the service-role
-- client can), plus job_skills, and two user-owned tables (job_matches,
-- saved_jobs). Depends on migration 001 (profiles) and, for the resume_id
-- reference on job_matches, migration 002 (resumes).
--
-- Apply via the Supabase SQL Editor, or `supabase db push` if this project
-- is linked via the CLI. Does not modify or drop anything from 001/002.

-- ---------------------------------------------------------------------------
-- jobs: shared/global table. Not user-owned — every authenticated user can
-- read it, but only trusted server-side ingestion (service-role client)
-- can write to it. See lib/jobs/discovery.ts.
-- ---------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_job_id text,
  title text not null,
  company_name text,
  location text,
  country text not null default 'Sri Lanka',
  employment_type text
    check (employment_type in (
      'internship', 'part_time', 'full_time', 'contract', 'freelance', 'volunteer', 'other'
    )),
  work_mode text check (work_mode in ('onsite', 'hybrid', 'remote')),
  description text,
  requirements text,
  responsibilities text,
  salary_text text,
  application_url text not null check (application_url ~ '^https://'),
  source_url text,
  posted_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  raw_data jsonb,
  normalized_data jsonb,
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.jobs is
  'Shared job listings from configured discovery providers. Global/read-only for authenticated users — write access is server-only (service role), never client-writable.';

-- source + source_job_id identifies a specific listing when the provider
-- gives us one; content_hash is the fallback dedup key when it doesn't
-- (see lib/jobs/deduplicate.ts).
create unique index jobs_source_source_job_id_idx
  on public.jobs (source, source_job_id) where source_job_id is not null;
create unique index jobs_content_hash_idx on public.jobs (content_hash);
create index jobs_location_idx on public.jobs (location);
create index jobs_posted_at_idx on public.jobs (posted_at);
create index jobs_is_active_idx on public.jobs (is_active);
create index jobs_source_idx on public.jobs (source);

create trigger jobs_set_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- job_skills: normalized skills extracted from a job (Gemini-assisted,
-- cached per content_hash — see lib/jobs/analyze-job.ts). Global, same
-- write posture as jobs.
-- ---------------------------------------------------------------------------

create table public.job_skills (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  skill_name text not null,
  skill_type text not null default 'technical'
    check (skill_type in ('technical', 'soft', 'tool', 'domain', 'language')),
  importance text not null default 'required'
    check (importance in ('required', 'preferred', 'nice_to_have')),
  created_at timestamptz not null default now()
);

create index job_skills_job_id_idx on public.job_skills (job_id);

-- ---------------------------------------------------------------------------
-- job_matches: cached, user-specific match score for one profile + job.
-- Never a universal score — always scoped to profile_id = auth.uid().
-- ---------------------------------------------------------------------------

create table public.job_matches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  match_score numeric(5, 2) not null check (match_score between 0 and 100),
  skills_score numeric(5, 2) check (skills_score is null or skills_score between 0 and 100),
  role_score numeric(5, 2) check (role_score is null or role_score between 0 and 100),
  experience_score numeric(5, 2) check (experience_score is null or experience_score between 0 and 100),
  education_score numeric(5, 2) check (education_score is null or education_score between 0 and 100),
  location_score numeric(5, 2) check (location_score is null or location_score between 0 and 100),
  keyword_score numeric(5, 2) check (keyword_score is null or keyword_score between 0 and 100),
  matched_skills jsonb not null default '[]',
  missing_required_skills jsonb not null default '[]',
  missing_preferred_skills jsonb not null default '[]',
  matched_keywords jsonb not null default '[]',
  missing_keywords jsonb not null default '[]',
  explanation jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_matches_unique unique (profile_id, job_id)
);

create index job_matches_profile_id_idx on public.job_matches (profile_id);
create index job_matches_job_id_idx on public.job_matches (job_id);

create trigger job_matches_set_updated_at before update on public.job_matches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- saved_jobs
-- ---------------------------------------------------------------------------

create table public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_jobs_unique unique (profile_id, job_id)
);

create index saved_jobs_profile_id_idx on public.saved_jobs (profile_id);
create index saved_jobs_job_id_idx on public.saved_jobs (job_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.jobs enable row level security;
alter table public.job_skills enable row level security;
alter table public.job_matches enable row level security;
alter table public.saved_jobs enable row level security;

-- jobs / job_skills: readable by any authenticated user. Deliberately NO
-- insert/update/delete policies for the `authenticated` role — the default
-- is deny, so normal users (even via their own valid session) cannot
-- write to these tables at all. Ingestion uses the service-role admin
-- client (lib/supabase/admin.ts), which bypasses RLS entirely, from
-- trusted server-side code only.
create policy "jobs_select_authenticated" on public.jobs
  for select to authenticated using (true);
create policy "job_skills_select_authenticated" on public.job_skills
  for select to authenticated using (true);

-- job_matches / saved_jobs: normal user-owned pattern, profile_id is the
-- owning user's auth uid by construction.
create policy "job_matches_select_own" on public.job_matches
  for select using (profile_id = auth.uid());
create policy "job_matches_insert_own" on public.job_matches
  for insert with check (profile_id = auth.uid());
create policy "job_matches_update_own" on public.job_matches
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "job_matches_delete_own" on public.job_matches
  for delete using (profile_id = auth.uid());

create policy "saved_jobs_select_own" on public.saved_jobs
  for select using (profile_id = auth.uid());
create policy "saved_jobs_insert_own" on public.saved_jobs
  for insert with check (profile_id = auth.uid());
create policy "saved_jobs_delete_own" on public.saved_jobs
  for delete using (profile_id = auth.uid());
