-- CareerLens AI — Phase 8: job-specific CV tailoring + cover letters.
--
-- Depends on migrations 001 (profiles), 002 (resumes), and 003 (jobs).
-- Job-level analysis (skills/keywords/requirements) already lives in
-- jobs/job_skills from migration 003 and is reused here, NOT duplicated —
-- only genuinely new, resume+job-specific data gets new tables.
--
-- Apply via the Supabase SQL Editor, or `supabase db push` if this project
-- is linked via the CLI. Does not modify or drop anything from 001/002/003.

-- ---------------------------------------------------------------------------
-- application_documents: one "application in progress" per (profile, job)
-- — the container tailored CV versions, its analysis, and cover letters
-- all hang off. profile_id is denormalized onto every child table below
-- (rather than requiring an EXISTS join back through this table) for
-- simpler, faster RLS — a deliberate, consistent choice with most of this
-- project's other user-owned tables (profiles' direct children).
-- ---------------------------------------------------------------------------

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  source_resume_id uuid not null references public.resumes (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One application-in-progress per job per user. Switching the source
  -- resume updates this row and a new version is generated under it,
  -- rather than creating a second parallel application for the same job.
  constraint application_documents_unique unique (profile_id, job_id)
);

create index application_documents_profile_id_idx on public.application_documents (profile_id);
create index application_documents_job_id_idx on public.application_documents (job_id);

create trigger application_documents_set_updated_at before update on public.application_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- application_analyses: deterministic resume-vs-job comparison for one
-- application_document. Recomputed (not versioned like CV/cover-letter
-- content) whenever the user re-runs analysis — it's working data that
-- informs tailoring, not a deliverable with its own history.
-- ---------------------------------------------------------------------------

create table public.application_analyses (
  id uuid primary key default gen_random_uuid(),
  application_document_id uuid not null unique
    references public.application_documents (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill_comparison jsonb not null default '[]',
  keyword_comparison jsonb not null default '[]',
  overall_keyword_alignment numeric(5, 2)
    check (overall_keyword_alignment is null or overall_keyword_alignment between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index application_analyses_profile_id_idx on public.application_analyses (profile_id);

create trigger application_analyses_set_updated_at before update on public.application_analyses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- application_document_versions: the actual tailored CV content.
-- Append-only — a new row per (re)generation. The ORIGINAL resume
-- (resumes/resume_versions from migration 002) is never modified.
-- ---------------------------------------------------------------------------

create table public.application_document_versions (
  id uuid primary key default gen_random_uuid(),
  application_document_id uuid not null
    references public.application_documents (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  tailored_content jsonb not null,
  tailoring_notes jsonb not null default '[]',
  keyword_alignment_before numeric(5, 2)
    check (keyword_alignment_before is null or keyword_alignment_before between 0 and 100),
  keyword_alignment_after numeric(5, 2)
    check (keyword_alignment_after is null or keyword_alignment_after between 0 and 100),
  created_at timestamptz not null default now(),
  constraint application_document_versions_unique unique (application_document_id, version_number)
);

create index application_document_versions_document_id_idx
  on public.application_document_versions (application_document_id);
create index application_document_versions_profile_id_idx
  on public.application_document_versions (profile_id);

-- ---------------------------------------------------------------------------
-- cover_letters: same versioning pattern as CV versions.
-- ---------------------------------------------------------------------------

create table public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  application_document_id uuid not null
    references public.application_documents (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  content text not null,
  created_at timestamptz not null default now(),
  constraint cover_letters_unique unique (application_document_id, version_number)
);

create index cover_letters_document_id_idx on public.cover_letters (application_document_id);
create index cover_letters_profile_id_idx on public.cover_letters (profile_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — standard owner-scoped pattern, profile_id = auth.uid()
-- directly on every table (see comment at top of file).
-- ---------------------------------------------------------------------------

alter table public.application_documents enable row level security;
alter table public.application_analyses enable row level security;
alter table public.application_document_versions enable row level security;
alter table public.cover_letters enable row level security;

create policy "application_documents_select_own" on public.application_documents
  for select using (profile_id = auth.uid());
create policy "application_documents_insert_own" on public.application_documents
  for insert with check (profile_id = auth.uid());
create policy "application_documents_update_own" on public.application_documents
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "application_documents_delete_own" on public.application_documents
  for delete using (profile_id = auth.uid());

create policy "application_analyses_select_own" on public.application_analyses
  for select using (profile_id = auth.uid());
create policy "application_analyses_insert_own" on public.application_analyses
  for insert with check (profile_id = auth.uid());
create policy "application_analyses_update_own" on public.application_analyses
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "application_analyses_delete_own" on public.application_analyses
  for delete using (profile_id = auth.uid());

create policy "application_document_versions_select_own" on public.application_document_versions
  for select using (profile_id = auth.uid());
create policy "application_document_versions_insert_own" on public.application_document_versions
  for insert with check (profile_id = auth.uid());
create policy "application_document_versions_delete_own" on public.application_document_versions
  for delete using (profile_id = auth.uid());

create policy "cover_letters_select_own" on public.cover_letters
  for select using (profile_id = auth.uid());
create policy "cover_letters_insert_own" on public.cover_letters
  for insert with check (profile_id = auth.uid());
create policy "cover_letters_delete_own" on public.cover_letters
  for delete using (profile_id = auth.uid());
