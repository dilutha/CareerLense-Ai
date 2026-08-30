-- CareerLens AI — Usability overhaul: profile intelligence (Part 5).
--
-- Purely additive: one nullable-with-default `source` column on each of
-- education/experience/projects/profile_skills, so entries auto-populated
-- from a CV/portfolio/GitHub can be distinguished from what the user typed
-- manually or told the agent in chat — the "verified/extracted vs
-- user-provided vs AI-inferred" distinction the onboarding redesign needs.
-- No RLS changes: these are already owner-scoped tables (migration 001),
-- and an added column doesn't change who can read/write a row.

alter table public.education
  add column source text not null default 'manual'
    check (source in ('manual', 'cv', 'portfolio', 'github', 'chat'));

alter table public.experience
  add column source text not null default 'manual'
    check (source in ('manual', 'cv', 'portfolio', 'github', 'chat'));

alter table public.projects
  add column source text not null default 'manual'
    check (source in ('manual', 'cv', 'portfolio', 'github', 'chat'));

alter table public.profile_skills
  add column source text not null default 'manual'
    check (source in ('manual', 'cv', 'portfolio', 'github', 'chat'));

comment on column public.education.source is
  'Where this entry came from: manual entry, extracted from an uploaded CV, a portfolio page, a GitHub profile, or mentioned in chat. Never overwrites/conflicts with existing entries — dedup is additive-only at the application layer (see lib/career-profile/populate-from-resume.ts).';
comment on column public.experience.source is 'Same meaning as education.source.';
comment on column public.projects.source is 'Same meaning as education.source.';
comment on column public.profile_skills.source is 'Same meaning as education.source.';
