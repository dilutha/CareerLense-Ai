-- CareerLens AI — Phase 10: portfolio/GitHub/LinkedIn intelligence,
-- interview coach, career readiness.
--
-- Depends on migrations 001 (profiles) and, for interview_sessions'
-- optional job link, 003 (jobs). Does not modify 001-005. Deliberately
-- does NOT create separate "portfolio_profiles"/"github_profiles"/
-- "linkedin_profiles" tables, or a career_readiness_snapshots table —
-- the URL/username/pasted-content each analysis was run against is
-- stored directly on that analysis row (one less join, and there's
-- nothing else those tables would hold), and career readiness is
-- computed live from the latest row in each *_analyses table rather than
-- persisted, since it's cheap to compute and would otherwise duplicate
-- data that already lives here.

-- ---------------------------------------------------------------------------
-- portfolio_analyses: append-only, like resume_versions/
-- application_document_versions — a new analysis is always a new row, the
-- previous one is never overwritten. category_scores/findings are
-- deterministic outputs of lib/portfolio/score.ts, not raw Gemini output —
-- Gemini only produces the findings (label/severity/impact), the score is
-- computed in application code (same "deterministic from structured
-- findings" pattern as resume_analysis, migration 002).
-- ---------------------------------------------------------------------------

create table public.portfolio_analyses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  url text not null check (url ~ '^https://'),
  content_hash text not null,
  version_number integer not null check (version_number > 0),
  seo_findings jsonb not null default '{}',
  category_scores jsonb not null default '{}',
  overall_score numeric(5, 2) check (overall_score is null or overall_score between 0 and 100),
  findings jsonb not null default '[]',
  created_at timestamptz not null default now(),
  constraint portfolio_analyses_unique unique (profile_id, url, version_number)
);

create index portfolio_analyses_profile_id_idx on public.portfolio_analyses (profile_id);
create index portfolio_analyses_content_hash_idx on public.portfolio_analyses (content_hash);

comment on column public.portfolio_analyses.seo_findings is
  'Structured, deterministic extraction results (title/meta/headings/OG/canonical/robots/sitemap/structured-data presence/image-alt coverage) — see lib/portfolio/extract.ts. Not an AI response; lets the UI render without re-parsing.';

-- ---------------------------------------------------------------------------
-- portfolio_generated_content: drafted hero/about/project/skills/summary/
-- CTA copy, always grounded in VerifiedFacts (lib/application/
-- verified-facts.ts, reused as-is from Phase 8). Append-only — a
-- regenerate creates a new row, never overwrites a prior draft the user
-- may have already copied.
-- ---------------------------------------------------------------------------

create table public.portfolio_generated_content (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  portfolio_analysis_id uuid references public.portfolio_analyses (id) on delete set null,
  section text not null check (section in ('hero', 'about', 'project', 'skills', 'summary', 'cta')),
  content text not null,
  created_at timestamptz not null default now()
);

create index portfolio_generated_content_profile_id_idx on public.portfolio_generated_content (profile_id);

-- ---------------------------------------------------------------------------
-- github_analyses: same append-only/deterministic-score pattern.
-- content_hash is over the fetched public repo list, so an unchanged
-- GitHub profile is never re-analyzed by Gemini on repeat visits.
-- ---------------------------------------------------------------------------

create table public.github_analyses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  github_username text not null,
  content_hash text not null,
  version_number integer not null check (version_number > 0),
  category_scores jsonb not null default '{}',
  overall_score numeric(5, 2) check (overall_score is null or overall_score between 0 and 100),
  findings jsonb not null default '[]',
  recommended_projects jsonb not null default '[]',
  created_at timestamptz not null default now(),
  constraint github_analyses_unique unique (profile_id, github_username, version_number)
);

create index github_analyses_profile_id_idx on public.github_analyses (profile_id);

-- ---------------------------------------------------------------------------
-- linkedin_analyses: analyzes only content the USER PASTES — never
-- fetched/scraped (see lib/linkedin/analyze-linkedin.ts). content_hash is
-- over the pasted text.
-- ---------------------------------------------------------------------------

create table public.linkedin_analyses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  content_hash text not null,
  version_number integer not null check (version_number > 0),
  category_scores jsonb not null default '{}',
  overall_score numeric(5, 2) check (overall_score is null or overall_score between 0 and 100),
  findings jsonb not null default '[]',
  created_at timestamptz not null default now(),
  constraint linkedin_analyses_unique unique (profile_id, version_number)
);

create index linkedin_analyses_profile_id_idx on public.linkedin_analyses (profile_id);

create table public.linkedin_generated_content (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  linkedin_analysis_id uuid references public.linkedin_analyses (id) on delete set null,
  section text not null check (section in ('headline_a', 'headline_b', 'headline_c', 'about', 'skills')),
  content text not null,
  created_at timestamptz not null default now()
);

create index linkedin_generated_content_profile_id_idx on public.linkedin_generated_content (profile_id);

-- ---------------------------------------------------------------------------
-- interview_sessions / interview_exchanges: a mock interview run,
-- optionally tied to a specific selected job. One exchange row per
-- question — created when the question is generated, updated in place
-- with the answer/feedback/score once the user responds (not append-only:
-- an exchange is one Q+A turn, not a version history).
-- ---------------------------------------------------------------------------

create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index interview_sessions_profile_id_idx on public.interview_sessions (profile_id);
create index interview_sessions_job_id_idx on public.interview_sessions (job_id);

create trigger interview_sessions_set_updated_at before update on public.interview_sessions
  for each row execute function public.set_updated_at();

create table public.interview_exchanges (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('general', 'technical', 'behavioral', 'project', 'job_specific')),
  question text not null,
  order_index integer not null check (order_index >= 0),
  answer_text text,
  feedback text,
  quality_score numeric(5, 2) check (quality_score is null or quality_score between 0 and 100),
  score_breakdown jsonb,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  constraint interview_exchanges_unique unique (session_id, order_index)
);

create index interview_exchanges_session_id_idx on public.interview_exchanges (session_id);
create index interview_exchanges_profile_id_idx on public.interview_exchanges (profile_id);

comment on column public.interview_exchanges.quality_score is
  'An "Answer Quality Score" (relevance/clarity/structure/technical accuracy) — deliberately not framed as an interview-success or hiring-probability prediction. See lib/interview/evaluate-answer.ts.';

-- ---------------------------------------------------------------------------
-- Row Level Security — every table here is user-owned, standard
-- profile_id = auth.uid() pattern (denormalized profile_id even on
-- interview_exchanges, which also has session_id, for the same
-- simple-consistent-RLS reasoning as migration 004).
-- ---------------------------------------------------------------------------

alter table public.portfolio_analyses enable row level security;
alter table public.portfolio_generated_content enable row level security;
alter table public.github_analyses enable row level security;
alter table public.linkedin_analyses enable row level security;
alter table public.linkedin_generated_content enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_exchanges enable row level security;

create policy "portfolio_analyses_select_own" on public.portfolio_analyses
  for select using (profile_id = auth.uid());
create policy "portfolio_analyses_insert_own" on public.portfolio_analyses
  for insert with check (profile_id = auth.uid());
create policy "portfolio_analyses_delete_own" on public.portfolio_analyses
  for delete using (profile_id = auth.uid());

create policy "portfolio_generated_content_select_own" on public.portfolio_generated_content
  for select using (profile_id = auth.uid());
create policy "portfolio_generated_content_insert_own" on public.portfolio_generated_content
  for insert with check (profile_id = auth.uid());
create policy "portfolio_generated_content_delete_own" on public.portfolio_generated_content
  for delete using (profile_id = auth.uid());

create policy "github_analyses_select_own" on public.github_analyses
  for select using (profile_id = auth.uid());
create policy "github_analyses_insert_own" on public.github_analyses
  for insert with check (profile_id = auth.uid());
create policy "github_analyses_delete_own" on public.github_analyses
  for delete using (profile_id = auth.uid());

create policy "linkedin_analyses_select_own" on public.linkedin_analyses
  for select using (profile_id = auth.uid());
create policy "linkedin_analyses_insert_own" on public.linkedin_analyses
  for insert with check (profile_id = auth.uid());
create policy "linkedin_analyses_delete_own" on public.linkedin_analyses
  for delete using (profile_id = auth.uid());

create policy "linkedin_generated_content_select_own" on public.linkedin_generated_content
  for select using (profile_id = auth.uid());
create policy "linkedin_generated_content_insert_own" on public.linkedin_generated_content
  for insert with check (profile_id = auth.uid());
create policy "linkedin_generated_content_delete_own" on public.linkedin_generated_content
  for delete using (profile_id = auth.uid());

create policy "interview_sessions_select_own" on public.interview_sessions
  for select using (profile_id = auth.uid());
create policy "interview_sessions_insert_own" on public.interview_sessions
  for insert with check (profile_id = auth.uid());
create policy "interview_sessions_update_own" on public.interview_sessions
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "interview_sessions_delete_own" on public.interview_sessions
  for delete using (profile_id = auth.uid());

create policy "interview_exchanges_select_own" on public.interview_exchanges
  for select using (profile_id = auth.uid());
create policy "interview_exchanges_insert_own" on public.interview_exchanges
  for insert with check (profile_id = auth.uid());
create policy "interview_exchanges_update_own" on public.interview_exchanges
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "interview_exchanges_delete_own" on public.interview_exchanges
  for delete using (profile_id = auth.uid());
