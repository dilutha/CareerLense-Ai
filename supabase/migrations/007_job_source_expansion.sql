-- CareerLens AI — Phase 10A: real job source expansion (SerpApi Google
-- Jobs as the worldwide/aggregator discovery provider).
--
-- Depends on migrations 001-006. Does not modify their files. Purely
-- additive on `jobs` (one new column) plus a data-only update to the
-- existing job_sources registry row that was seeded in migration 005 as a
-- generic placeholder ("worldwide") for exactly this kind of provider —
-- now that a concrete implementation (SerpApi) exists, it's renamed
-- rather than left as a duplicate, unused row. No new tables: the
-- existing jobs.duplicate_of mechanism (migration 005) already supports
-- "one real-world vacancy, multiple source rows" — see
-- lib/jobs/cross-source-dedupe.ts — so a separate job_sources-per-job
-- junction table was evaluated and judged unnecessary (docs/JOB_DATA.md
-- has the full reasoning).

alter table public.jobs
  add column source_type text not null default 'job_board'
    check (source_type in ('job_board', 'aggregator_result', 'official_company', 'fixture'));

comment on column public.jobs.source_type is
  'job_board (e.g. ITPro.lk) / aggregator_result (SerpApi Google Jobs — LinkedIn/Indeed/etc surfaced via Google) / official_company (schema.org career-page extraction) / fixture (demo data). Drives the deterministic source-confidence label in lib/jobs/source-confidence.ts — never a fabricated numeric score.';

-- The "worldwide" placeholder from migration 005 is now a concrete,
-- verified implementation — rename in place rather than insert a
-- duplicate row (no job_source_runs ever referenced "worldwide", since
-- no worldwide-search credential was ever configured, so this is safe).
update public.job_sources
set
  key = 'serpapi',
  name = 'SerpApi Google Jobs',
  status = 'configuration_required'
where key = 'worldwide';
