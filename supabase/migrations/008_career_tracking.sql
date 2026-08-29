-- CareerLens AI — Phase 11: application tracking, learning roadmaps.
--
-- Depends on migrations 001 (profiles), 003 (jobs), 004
-- (application_documents, for linking which tailored CV/cover letter was
-- used). Does not modify any prior migration file — purely additive: 4
-- new tables. Does NOT create a "career_insights" table — insight cards
-- (Part 20) are computed live from applications/skill-gap/resume-
-- performance data on each dashboard render, the same "compute live,
-- don't persist a stale copy" pattern migration 006 already established
-- for career readiness — see docs/DATABASE.md for the full reasoning.
--
-- `applications` is intentionally a NEW table, not a further extension of
-- application_documents (Phase 8/10) — application_documents requires a
-- source_resume_id (NOT NULL, since it exists to store CV-tailoring
-- output) and so can't represent "I'm just interested, haven't tailored a
-- CV yet" (status: saved/interested), which this phase's status list
-- explicitly needs as starting states. `applications.application_document_id`
-- is a nullable FK back to application_documents for when tailoring HAS
-- happened, so "Applied with: CV Version 3" can be shown without
-- duplicating any tailoring data.

-- ---------------------------------------------------------------------------
-- applications: the canonical application-tracking record. One per
-- (profile, job) — re-tracking the same job updates this row rather than
-- creating a duplicate.
-- ---------------------------------------------------------------------------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  application_document_id uuid references public.application_documents (id) on delete set null,
  status text not null default 'saved'
    check (status in (
      'saved', 'interested', 'preparing', 'applied', 'screening',
      'interview', 'final_round', 'offer', 'rejected', 'withdrawn', 'closed'
    )),
  notes text,
  follow_up_date date,
  applied_at timestamptz,
  last_status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_unique unique (profile_id, job_id)
);

create index applications_profile_id_idx on public.applications (profile_id);
create index applications_job_id_idx on public.applications (job_id);
create index applications_status_idx on public.applications (status);
create index applications_follow_up_date_idx on public.applications (follow_up_date) where follow_up_date is not null;

create trigger applications_set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

comment on table public.applications is
  'The canonical application-tracking record — distinct from application_documents (Phase 8), which is specifically CV/cover-letter tailoring output and requires a resume to exist. This table starts at "saved", before any tailoring happens.';

-- ---------------------------------------------------------------------------
-- application_status_history: append-only. No UPDATE/DELETE policy for
-- the client at all — a status change is a fact, never rewritten.
-- ---------------------------------------------------------------------------

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_at timestamptz not null default now(),
  note text
);

create index application_status_history_application_id_idx on public.application_status_history (application_id);

-- ---------------------------------------------------------------------------
-- learning_roadmaps / learning_roadmap_items: a regenerable plan (not
-- append-only — regenerating replaces the plan in place, same as a saved
-- document you keep editing), one per (profile, target_role).
-- content_hash lets the roadmap-generation action skip a Gemini call when
-- nothing relevant (skills, target role, market data) has changed.
-- ---------------------------------------------------------------------------

create table public.learning_roadmaps (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  target_role text not null,
  content_hash text not null,
  summary text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_roadmaps_unique unique (profile_id, target_role)
);

create index learning_roadmaps_profile_id_idx on public.learning_roadmaps (profile_id);

create trigger learning_roadmaps_set_updated_at before update on public.learning_roadmaps
  for each row execute function public.set_updated_at();

create table public.learning_roadmap_items (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.learning_roadmaps (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  step_order integer not null check (step_order >= 0),
  title text not null,
  skill text not null,
  resource_type text not null
    check (resource_type in ('course', 'documentation', 'tutorial', 'practice', 'project', 'certification')),
  -- Deterministically assigned from a hand-curated, verified catalog
  -- (lib/learning/resource-catalog.ts) — Gemini never supplies this URL,
  -- so it can never hallucinate a broken/fake link. Null when no verified
  -- resource exists for the skill; resource_note then carries an honest
  -- "search for X" suggestion instead (never a fabricated link).
  resource_url text check (resource_url is null or resource_url ~ '^https://'),
  resource_note text,
  estimated_duration_text text,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint learning_roadmap_items_unique unique (roadmap_id, step_order)
);

create index learning_roadmap_items_roadmap_id_idx on public.learning_roadmap_items (roadmap_id);
create index learning_roadmap_items_profile_id_idx on public.learning_roadmap_items (profile_id);

comment on column public.learning_roadmap_items.resource_url is
  'Only ever set from lib/learning/resource-catalog.ts''s hand-verified URL list — never Gemini-generated, so a course link can never be hallucinated.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.learning_roadmaps enable row level security;
alter table public.learning_roadmap_items enable row level security;

create policy "applications_select_own" on public.applications
  for select using (profile_id = auth.uid());
create policy "applications_insert_own" on public.applications
  for insert with check (profile_id = auth.uid());
create policy "applications_update_own" on public.applications
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "applications_delete_own" on public.applications
  for delete using (profile_id = auth.uid());

-- Append-only: select + insert only, no update/delete policy at all for
-- the client (default deny) — a status history entry is never rewritten.
create policy "application_status_history_select_own" on public.application_status_history
  for select using (profile_id = auth.uid());
create policy "application_status_history_insert_own" on public.application_status_history
  for insert with check (profile_id = auth.uid());

create policy "learning_roadmaps_select_own" on public.learning_roadmaps
  for select using (profile_id = auth.uid());
create policy "learning_roadmaps_insert_own" on public.learning_roadmaps
  for insert with check (profile_id = auth.uid());
create policy "learning_roadmaps_update_own" on public.learning_roadmaps
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "learning_roadmaps_delete_own" on public.learning_roadmaps
  for delete using (profile_id = auth.uid());

create policy "learning_roadmap_items_select_own" on public.learning_roadmap_items
  for select using (profile_id = auth.uid());
create policy "learning_roadmap_items_insert_own" on public.learning_roadmap_items
  for insert with check (profile_id = auth.uid());
create policy "learning_roadmap_items_update_own" on public.learning_roadmap_items
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "learning_roadmap_items_delete_own" on public.learning_roadmap_items
  for delete using (profile_id = auth.uid());
