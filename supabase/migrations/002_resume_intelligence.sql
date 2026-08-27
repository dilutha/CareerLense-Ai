-- CareerLens AI — Phase 6: CV upload + resume intelligence.
--
-- Adds resumes / resume_versions / resume_analysis, plus a private Storage
-- bucket and its access policies. Depends on migration 001 (profiles must
-- already exist) — apply 001 first if it hasn't been applied yet.
--
-- Apply via the Supabase SQL Editor, or `supabase db push` if this project
-- is linked via the CLI.

-- ---------------------------------------------------------------------------
-- resumes: one row per uploaded CV file.
-- ---------------------------------------------------------------------------

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  original_filename text not null,
  storage_path text not null,
  file_type text not null check (file_type in ('pdf', 'docx')),
  file_size bigint not null check (file_size > 0),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed')),
  error_message text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resumes_profile_id_idx on public.resumes (profile_id);

-- Only one default resume per profile.
create unique index resumes_one_default_per_profile_idx
  on public.resumes (profile_id) where is_default;

create trigger resumes_set_updated_at before update on public.resumes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- resume_versions: extracted text + parsed structured data.
--
-- The binary file itself stays in Storage — never duplicated here. A resume
-- can have multiple versions later (e.g. a tailored copy for a specific
-- role); Phase 6 only ever creates version 1 per resume.
-- ---------------------------------------------------------------------------

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  version_number integer not null default 1 check (version_number > 0),
  label text,
  extracted_text text,
  text_truncated boolean not null default false,
  parsed_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resume_versions_unique unique (resume_id, version_number)
);

create index resume_versions_resume_id_idx on public.resume_versions (resume_id);

create trigger resume_versions_set_updated_at before update on public.resume_versions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- resume_analysis: CareerLens's evaluation of one resume version.
--
-- `summary` / `experience_summary` / `education_summary` are short prose,
-- stored as plain text rather than JSONB. Everything genuinely structured
-- (findings, skills, projects, suggestions) is JSONB — AI-generated
-- analytical output doesn't need to be normalized into more tables.
-- ---------------------------------------------------------------------------

create table public.resume_analysis (
  id uuid primary key default gen_random_uuid(),
  resume_version_id uuid not null references public.resume_versions (id) on delete cascade,
  overall_score numeric(5, 2) check (overall_score is null or (overall_score between 0 and 100)),
  score_breakdown jsonb,
  summary text,
  strengths jsonb not null default '[]',
  weaknesses jsonb not null default '[]',
  skills jsonb not null default '[]',
  experience_summary text,
  education_summary text,
  projects jsonb not null default '[]',
  missing_sections jsonb not null default '[]',
  keyword_suggestions jsonb not null default '[]',
  formatting_feedback jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index resume_analysis_resume_version_id_idx on public.resume_analysis (resume_version_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- resumes.profile_id is, by construction, the owning user's auth uid (same
-- pattern as migration 001's child tables). resume_versions and
-- resume_analysis don't carry profile_id directly, so their policies walk
-- back up to resumes via EXISTS.
-- ---------------------------------------------------------------------------

alter table public.resumes enable row level security;
alter table public.resume_versions enable row level security;
alter table public.resume_analysis enable row level security;

create policy "resumes_select_own" on public.resumes
  for select using (profile_id = auth.uid());
create policy "resumes_insert_own" on public.resumes
  for insert with check (profile_id = auth.uid());
create policy "resumes_update_own" on public.resumes
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "resumes_delete_own" on public.resumes
  for delete using (profile_id = auth.uid());

create policy "resume_versions_select_own" on public.resume_versions
  for select using (
    exists (
      select 1 from public.resumes r
      where r.id = resume_versions.resume_id and r.profile_id = auth.uid()
    )
  );
create policy "resume_versions_insert_own" on public.resume_versions
  for insert with check (
    exists (
      select 1 from public.resumes r
      where r.id = resume_versions.resume_id and r.profile_id = auth.uid()
    )
  );
create policy "resume_versions_update_own" on public.resume_versions
  for update using (
    exists (
      select 1 from public.resumes r
      where r.id = resume_versions.resume_id and r.profile_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.resumes r
      where r.id = resume_versions.resume_id and r.profile_id = auth.uid()
    )
  );
create policy "resume_versions_delete_own" on public.resume_versions
  for delete using (
    exists (
      select 1 from public.resumes r
      where r.id = resume_versions.resume_id and r.profile_id = auth.uid()
    )
  );

create policy "resume_analysis_select_own" on public.resume_analysis
  for select using (
    exists (
      select 1 from public.resume_versions rv
      join public.resumes r on r.id = rv.resume_id
      where rv.id = resume_analysis.resume_version_id and r.profile_id = auth.uid()
    )
  );
create policy "resume_analysis_insert_own" on public.resume_analysis
  for insert with check (
    exists (
      select 1 from public.resume_versions rv
      join public.resumes r on r.id = rv.resume_id
      where rv.id = resume_analysis.resume_version_id and r.profile_id = auth.uid()
    )
  );
create policy "resume_analysis_delete_own" on public.resume_analysis
  for delete using (
    exists (
      select 1 from public.resume_versions rv
      join public.resumes r on r.id = rv.resume_id
      where rv.id = resume_analysis.resume_version_id and r.profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: private "resumes" bucket.
--
-- Object paths are {user_id}/{resume_id}/{filename} *within* the bucket —
-- the bucket_id already namespaces "resumes", so it isn't repeated in the
-- path. storage.foldername(name) splits that path; element 1 is the
-- owning user's id.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "resumes_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "resumes_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "resumes_storage_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "resumes_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
