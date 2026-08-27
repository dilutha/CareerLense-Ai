-- CareerLens AI — Phase 5: authentication + career profile schema.
--
-- Creates one profile per authenticated user (profiles.id = auth.users.id),
-- plus the relational tables that make up a career profile: skills,
-- education, experience, projects, and career preferences.
--
-- Row Level Security is enabled on every table so a user can only ever
-- read/write their own data. `skills` is the one shared/global lookup
-- table — any authenticated user can read it or add a new skill, but no
-- one can update or delete existing entries via the client.
--
-- Apply via the Supabase SQL Editor, or `supabase db push` if this project
-- is linked via the CLI.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  headline text,
  bio text,
  location text,
  phone text,
  linkedin_url text,
  github_url text,
  portfolio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One career profile per authenticated user. id = auth.users.id.';

-- ---------------------------------------------------------------------------
-- skills: shared, global lookup table (not user-owned).
-- ---------------------------------------------------------------------------

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  -- Free-text category (e.g. technical, programming, database, analytics,
  -- cloud, design, business, soft_skill, language, other) — intentionally
  -- not constrained to a fixed list, since new categories may be useful
  -- later.
  category text not null default 'other',
  name text not null,
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness so "Python" / "python" / "PYTHON" can't exist
-- as three separate rows. Application code looks up by lower(name) before
-- inserting.
create unique index skills_name_lower_unique_idx on public.skills (lower(name));

-- ---------------------------------------------------------------------------
-- profile_skills: many-to-many between profiles and skills.
-- ---------------------------------------------------------------------------

create table public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  proficiency text not null default 'intermediate'
    check (proficiency in ('beginner', 'intermediate', 'advanced', 'expert')),
  years_experience numeric(4, 1) check (years_experience is null or years_experience >= 0),
  created_at timestamptz not null default now(),
  constraint profile_skills_unique unique (profile_id, skill_id)
);

create index profile_skills_profile_id_idx on public.profile_skills (profile_id);
create index profile_skills_skill_id_idx on public.profile_skills (skill_id);

-- ---------------------------------------------------------------------------
-- education
-- ---------------------------------------------------------------------------

create table public.education (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  institution text not null,
  degree text,
  field_of_study text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_dates_check check (
    is_current or end_date is null or start_date is null or end_date >= start_date
  )
);

create index education_profile_id_idx on public.education (profile_id);

-- ---------------------------------------------------------------------------
-- experience
-- ---------------------------------------------------------------------------

create table public.experience (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  company text not null,
  role text not null,
  employment_type text not null default 'internship'
    check (employment_type in (
      'internship', 'part_time', 'full_time', 'contract', 'freelance', 'volunteer', 'other'
    )),
  location text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experience_dates_check check (
    is_current or end_date is null or start_date is null or end_date >= start_date
  )
);

create index experience_profile_id_idx on public.experience (profile_id);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  project_url text,
  github_url text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_dates_check check (
    is_current or end_date is null or start_date is null or end_date >= start_date
  )
);

create index projects_profile_id_idx on public.projects (profile_id);

-- ---------------------------------------------------------------------------
-- career_preferences: one row per profile.
-- ---------------------------------------------------------------------------

create table public.career_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  target_role text,
  employment_type text
    check (employment_type in ('internship', 'part_time', 'full_time', 'contract', 'freelance', 'any')),
  preferred_locations text[] not null default '{}',
  remote_preference text check (remote_preference in ('remote', 'hybrid', 'on_site', 'any')),
  preferred_industries text[] not null default '{}',
  minimum_salary integer check (minimum_salary is null or minimum_salary >= 0),
  maximum_salary integer check (maximum_salary is null or maximum_salary >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint career_preferences_salary_range_check check (
    minimum_salary is null or maximum_salary is null or minimum_salary <= maximum_salary
  )
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger education_set_updated_at before update on public.education
  for each row execute function public.set_updated_at();
create trigger experience_set_updated_at before update on public.experience
  for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger career_preferences_set_updated_at before update on public.career_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Automatic profile creation on signup.
--
-- SECURITY DEFINER is required here so the trigger can insert into
-- public.profiles on behalf of a brand-new auth.users row, before that
-- user's own RLS-scoped session exists. `on conflict do nothing` makes this
-- idempotent — re-running signup logic (or a retried trigger) can never
-- create a duplicate profile.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.profile_skills enable row level security;
alter table public.education enable row level security;
alter table public.experience enable row level security;
alter table public.projects enable row level security;
alter table public.career_preferences enable row level security;

-- profiles: a user can only see/change their own row.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- skills: shared reference data. Any authenticated user can read all
-- skills and add a new one; nobody can edit or delete existing entries via
-- the client (only via a service-role/admin operation, if ever needed).
create policy "skills_select_authenticated" on public.skills
  for select to authenticated using (true);
create policy "skills_insert_authenticated" on public.skills
  for insert to authenticated with check (true);

-- Child tables: profile_id is, by construction, the owning user's auth
-- uid — so comparing it directly to auth.uid() is sufficient and avoids an
-- extra join against profiles.

create policy "profile_skills_select_own" on public.profile_skills
  for select using (profile_id = auth.uid());
create policy "profile_skills_insert_own" on public.profile_skills
  for insert with check (profile_id = auth.uid());
create policy "profile_skills_update_own" on public.profile_skills
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "profile_skills_delete_own" on public.profile_skills
  for delete using (profile_id = auth.uid());

create policy "education_select_own" on public.education
  for select using (profile_id = auth.uid());
create policy "education_insert_own" on public.education
  for insert with check (profile_id = auth.uid());
create policy "education_update_own" on public.education
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "education_delete_own" on public.education
  for delete using (profile_id = auth.uid());

create policy "experience_select_own" on public.experience
  for select using (profile_id = auth.uid());
create policy "experience_insert_own" on public.experience
  for insert with check (profile_id = auth.uid());
create policy "experience_update_own" on public.experience
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "experience_delete_own" on public.experience
  for delete using (profile_id = auth.uid());

create policy "projects_select_own" on public.projects
  for select using (profile_id = auth.uid());
create policy "projects_insert_own" on public.projects
  for insert with check (profile_id = auth.uid());
create policy "projects_update_own" on public.projects
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "projects_delete_own" on public.projects
  for delete using (profile_id = auth.uid());

create policy "career_preferences_select_own" on public.career_preferences
  for select using (profile_id = auth.uid());
create policy "career_preferences_insert_own" on public.career_preferences
  for insert with check (profile_id = auth.uid());
create policy "career_preferences_update_own" on public.career_preferences
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "career_preferences_delete_own" on public.career_preferences
  for delete using (profile_id = auth.uid());
