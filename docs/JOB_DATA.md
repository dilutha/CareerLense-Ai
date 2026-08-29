# Job Data

Status: **multi-source discovery (Phase 10A)**. ITPro.lk is a real, live,
working source — verified directly, no API key required. SerpApi Google
Jobs (the worldwide/aggregator provider — surfaces LinkedIn, Indeed, and
company-site listings with their own real apply links) is fully
implemented and verified against SerpApi's own documentation, but **no
`SERPAPI_API_KEY` is configured in this environment**, so it honestly
reports `configuration_required` rather than returning results — live API
testing was not possible without a key (see "Live testing" below). Company
career pages have a real, working extraction mechanism but zero pages are
currently seeded. XpressJobs and ikman.lk aren't searched automatically
(no public API); LinkedIn is never scraped directly — it's only reachable
through SerpApi's aggregation, or via a manual "paste a job URL" import.
The demo/fixture provider still exists for local development, always
clearly labeled, never mixed silently with real results.

## Architecture

```text
JobSearchProvider (lib/jobs/providers/types.ts)
        │
        ├── itpro (lib/jobs/providers/itpro.ts)              — real, active
        ├── company-careers (lib/jobs/providers/company-careers.ts) — real mechanism, 0 seeded pages
        ├── serpapi (lib/jobs/providers/serpapi.ts)          — real implementation, no SERPAPI_API_KEY configured
        └── demo (lib/jobs/providers/demo.ts)                — fixture, opt-in only (JOB_SEARCH_PROVIDER=demo)

Source registry (lib/jobs/providers/registry.ts) — every source CareerLens
knows about, not just active ones; mirrored into the `job_sources` table
(migration 005, renamed from a generic "worldwide" placeholder to
"serpapi" in migration 007) so real health (last_successful_run_at/
last_error) persists.
```

Note on file naming: the spec's suggested `lib/jobs/providers/official.ts`
maps to the existing `company-careers.ts` (built in Phase 9, does exactly
this) — not duplicated under a second name. No `apyhub.ts` exists — see
"APYHub" below for why.

`lib/jobs/providers/index.ts#getActiveProviders()` selects providers by
`JOB_SEARCH_PROVIDER` (defaults to `real` as of Phase 9 — previously
`demo`, back when no real provider existed). One provider failing never
fails the whole search — `lib/jobs/discovery.ts#runProvider` wraps each in
try/catch, and every result carries per-provider `status`/`message`.

### Pipeline

```text
Provider.search() → raw NormalizedJob[] (query expansion + location resolution
        for geo-aware providers — lib/jobs/query-expansion.ts, bounded to
        MAX_QUERY_VARIANTS=2 per search — see "Cost protection" below)
        ↓
validateNormalizedJob (Zod, lib/jobs/normalize.ts) — rejects malformed entries, never throws
        ↓
deduplicateJobs (lib/jobs/deduplicate.ts) — same-source repeats in one batch
        ↓
upsertJobs (lib/jobs/discovery.ts) — content_hash-keyed upsert into `jobs`,
        preserves first_seen_at across re-discovery, always bumps last_seen_at
        ↓
linkCrossSourceDuplicates (lib/jobs/cross-source-dedupe.ts) — links a
        DIFFERENT source's row for the same real-world vacancy via
        jobs.duplicate_of, never deletes either row
        ↓
ensureJobsAnalyzed (lib/jobs/analyze-job.ts) — Gemini skill extraction,
        gated by existing job_skills rows, never re-run for an unchanged listing
        ↓
recordSourceRuns — job_source_runs + job_sources health bookkeeping
```

## Provider status (verified, not assumed)

| Source | Region | Access method | Status | Automated search? |
| --- | --- | --- | --- | --- |
| **ITPro.lk** | Sri Lanka | Official public API | **Available** | Yes |
| **SerpApi Google Jobs** | Global | Official REST API (Google Jobs aggregation) | Implemented; **configuration required** (`SERPAPI_API_KEY` unset) | Yes, once configured |
| Company Careers | Sri Lanka / Global | schema.org JobPosting (structured data) | Configuration required (0 pages seeded) | Yes, once seeded |
| XpressJobs | Sri Lanka | — (no API found) | Unavailable | No — manual/paste-URL only |
| ikman.lk Jobs | Sri Lanka | — (no API found) | Unavailable | No — manual/paste-URL only |
| LinkedIn | Global | Via SerpApi's Google Jobs aggregation only (when configured); never scraped directly | Blocked (direct) / available via SerpApi | No direct search — manual/paste-URL, or indirectly via SerpApi |
| Demo Data | N/A | Fixture | Available (opt-in) | Yes, `JOB_SEARCH_PROVIDER=demo` only |

### ITPro.lk — implemented, verified live

Investigated directly this session, not assumed:

- **Base URL:** `https://itpro.lk/api/v1`. `GET /jobs` (list) and
  `GET /jobs/{id}` (detail) are documented at `https://itpro.lk/developer/`
  and confirmed working by a direct, unauthenticated request — returned a
  real JSON array of current listings with zero auth headers sent.
- **Auth:** the developer docs describe an `X-API-Key` header, issued when
  a job is posted or on request to `info@itpro.lk` — not a self-serve
  signup flow. Not required for the reads this provider performs (verified
  live). `lib/jobs/providers/itpro.ts` sends `ITPRO_API_KEY` if it's ever
  set, but doesn't require it.
- **`robots.txt`:** no rule mentions `/developer` or `/api` at all — only
  disallows admin/config paths, consistent with this being a sanctioned,
  intentional feature.
- **Known, undocumented limitations — not worked around:** no pagination
  or filter parameters are documented (`?page=`/`?limit=` return `200` but
  aren't confirmed to change results, so this provider doesn't rely on
  them — it takes whatever the endpoint's default "latest jobs" set is,
  currently ~10). `location` and `type_id` are **numeric codes with no
  public lookup table** — `/locations`, `/categories`, `/types` all 404.
  Rather than guess a mapping, `NormalizedJob.location` is left `null` for
  ITPro jobs. `employmentType`/`workMode` ARE recovered, but only via
  literal keyword matching against ITPro's own `summary` sentence (e.g. it
  containing the literal word "Internship") — reading the source's stated
  words, never inferring beyond them.
- **Job URL:** ITPro's own site uses `https://itpro.lk/job/{id}/{slug}/`;
  verified live that the server redirects correctly on the numeric ID
  alone even with a wrong/garbage slug, so the constructed URL (via a
  best-effort slugified title) always resolves to the real listing. Used
  as both `applicationUrl` and `sourceUrl` — ITPro doesn't expose a
  separate employer-side "apply" link field.
- **Caching:** a 5-minute in-process cache avoids re-hitting the API for
  back-to-back searches on the same server instance (no rate limit is
  documented, but hammering an undocumented-limit API isn't reasonable
  either).

### Company career pages — mechanism implemented, zero pages seeded

`lib/jobs/providers/company-careers.ts` fetches a configured career page
(SSRF-guarded, robots.txt-checked — see Security below) and extracts
schema.org `JobPosting` JSON-LD (`lib/jobs/jobposting-schema.ts`) —
structured data companies embed specifically so Google for Jobs and
similar engines can index postings automatically; this is meant for
exactly this kind of machine consumption, confirmed via Google's own
JobPosting documentation.

**`COMPANY_CAREER_SOURCES` is currently empty.** WSO2's and Virtusa's
public career pages were checked directly this session
(`https://www.wso2.com/careers/`, `https://www.virtusa.com/careers`) and
both returned **HTTP 403 Forbidden** to a normal automated request
(bot-protected), so neither was added. No other candidate was verified in
the time available. This is the intended extension point — add an entry
only after manually confirming a specific page actually serves JobPosting
data; never add a company on the assumption that it does. The same
extractor also powers the "paste a job URL" manual-import flow (see
below), so it's exercised even with zero seeded pages.

### XpressJobs

`https://xpress.jobs` (xpressjobs.lk redirects here). `robots.txt` is
fully open (`Disallow:` empty, explicitly allows AI crawlers) — automated
access is technically permitted. However, **no public API, RSS feed, or
documented structured data was found** — the only way to get data would
be scraping undocumented HTML structure, which this project deliberately
avoids (guessing markup selectors is exactly the kind of "guessing an
undocumented contract" the project rules prohibit, even where robots.txt
allows the request itself). Marked `unavailable` for automated search; the
`/jobs` page offers an external "Search XpressJobs" link and the
paste-a-URL import (works if a specific listing happens to expose
JobPosting data, degrades to "paste the description in chat" otherwise).

### ikman.lk Jobs

`robots.txt` blocks many query-parameter/account paths but has **no rule
blocking `/jobs`**. Same conclusion as XpressJobs: crawling is technically
permitted by robots.txt, but no public API or structured data was found,
so this project doesn't guess an HTML scraper. Same manual fallback as
XpressJobs.

### LinkedIn

Confirmed via LinkedIn's own published policies: their Terms of Service
explicitly prohibit automated scraping/data collection, and Jobs API
access requires partner approval, not self-serve developer signup. This
is a hard, not-technical limitation — CareerLens will not automate
LinkedIn login, bypass CAPTCHA/anti-bot mechanisms, or scrape authenticated
content, regardless of whether it would be technically possible.

As of Phase 10A, LinkedIn-origin listings CAN appear — but only
indirectly, through SerpApi's Google Jobs aggregation (see below), which
is itself a legitimate, documented API, not a LinkedIn scraper. When a
SerpApi result's `apply_options` includes an entry titled "LinkedIn" (or
`via` says so), `lib/jobs/providers/serpapi.ts` preserves that as the
job's `sourceName` and uses LinkedIn's own apply link as `applicationUrl`
— CareerLens never claims "LinkedIn provider found this job" (there is no
LinkedIn provider), only "found via Google Jobs, originally on LinkedIn."
Without `SERPAPI_API_KEY` configured, this path is inactive. Independent
of SerpApi, the `/jobs` page still offers "Search LinkedIn externally"
(opens linkedin.com/jobs/) and a paste-a-job-URL/description fallback.

This is about LinkedIn *job listings*. For optimizing the user's own
LinkedIn *profile* (headline/About/skills — Phase 10, `/linkedin`), the
same ToS restriction applies and the same resolution is used: only
user-pasted content is ever analyzed, never fetched — see
`docs/AI_AGENT.md`'s career-intelligence section.

### SerpApi Google Jobs — implemented, verified against documentation, not yet live-tested

The primary worldwide/broad discovery provider (`lib/jobs/providers/serpapi.ts`).
Investigated directly this session against SerpApi's own docs, not guessed:

- **Endpoint:** `GET https://serpapi.com/search?engine=google_jobs&q=...&api_key=...`
  — called via plain `fetch()`, no SDK dependency added (the official
  `serpapi` npm package exists but the REST call is a single GET, not
  worth a new dependency for).
- **Params used:** `q` (from `lib/jobs/query-expansion.ts`'s bounded
  expansion — at most `MAX_QUERY_VARIANTS` = 2 variants per search),
  `location` (from `resolveSearchLocation` — combines the user's
  location + country, e.g. "Colombo, Sri Lanka", or omitted entirely for
  an unscoped remote search), `hl=en`.
- **Deliberately NOT used:** `chips` (date-posted filter) and `ltype`
  (remote filter) — SerpApi's own documentation marks both as
  **deprecated by Google**. Freshness and remote-work signals are instead
  read from each result's own fields client-side
  (`detected_extensions.posted_at` via `lib/jobs/relative-date.ts`,
  location/description text for "remote").
- **Application URL:** `jobs_results[].apply_options` is SerpApi's
  per-source apply-link array (e.g. a LinkedIn entry, an Indeed entry,
  sometimes the employer's own site) — the first `https://` entry is used
  as `applicationUrl`, its `title` as `sourceName`. Falls back to
  `share_link` (Google's own result page) only when no apply option
  exists. SerpApi's docs don't guarantee `apply_options` always resolves
  to the literal original poster, so every SerpApi job is conservatively
  labeled `sourceType: "aggregator_result"` (MEDIUM source confidence,
  see `lib/jobs/source-confidence.ts`) rather than assumed to be the
  official employer link.
- **Rate limits/pricing:** not stated on SerpApi's docs page itself;
  third-party sources report a free tier around 250 searches/month —
  **unverified directly from serpapi.com**, so this project doesn't rely
  on a specific number. Cost protection instead comes from the bounded
  query-variant count above, a 5-minute in-process response cache keyed
  by exact query+location, and never calling this provider from anything
  but an explicit user search (no background/scheduled polling).
- **Status:** implemented and unit-tested against real-shaped and
  malformed mock responses (never a real paid call in tests — see
  Testing below). **`SERPAPI_API_KEY` is not configured in this
  environment**, so it has not been live-tested — the provider correctly
  reports `configuration_required` rather than pretending to work.

### APYHub — evaluated, not required

Investigated directly this session (fetched their actual endpoint, not
marketing copy): APYHub genuinely offers
`GET https://api.eu.apyhub.com/apyhub/extract-visible-text-from-awebpage`
— a real, documented visible-text extraction API. Not integrated, because:

1. **Free tier is 5 calls/day** — not viable for anything beyond a single
   manual test, regardless of how useful the capability is.
2. **It only returns visible text**, not structured metadata (title, meta
   description, headings, canonical/OG/JSON-LD presence, image alt
   coverage). `lib/portfolio/extract.ts` (Phase 10) already does
   everything this endpoint does, for free, with zero external
   dependency, plus the structured signals APYHub's endpoint doesn't
   provide at all.
3. Whether it executes client-side JavaScript (which would be its one
   genuine edge over a plain `fetch()`) is **not stated in their docs** —
   unconfirmed, so it can't be relied on for that either.

**Conclusion: APYHub evaluated but not required.** No `apyhub.ts`
provider, no `APYHUB_API_KEY` env var — adding either would be an
unjustified dependency for a capability this project already has.

### Source confidence

`lib/jobs/source-confidence.ts#getSourceConfidence` — a fixed, documented
mapping from `source_type` to a qualitative label (`HIGH`/`MEDIUM`/`LOW`),
never a fabricated numeric score:

| source_type | Confidence | Why |
| --- | --- | --- |
| `job_board` (ITPro) | HIGH | Direct official API |
| `official_company` (company-careers) | HIGH | CareerLens fetched and parsed the page itself |
| `aggregator_result` (SerpApi) | MEDIUM | Real API, but Google Jobs aggregates mixed-quality sources and `apply_options` resolution isn't guaranteed by SerpApi's own docs |
| `fixture` (demo) | LOW | Not real data |

### Cost protection (SerpApi and any future metered provider)

- Query expansion capped at `MAX_QUERY_VARIANTS` = 2 per search
  (`lib/jobs/query-expansion.ts`).
- One location string per search — never fans out into multiple city
  calls (that would multiply metered-API cost for marginal benefit).
- 5-minute in-process response cache, keyed by exact query + location.
- Only ever called from an explicit user search — no background polling,
  no scheduled "infinite crawler" (PROJECT_SPEC's own "no autonomous
  crawling" instruction).
- Search results are filtered/deduplicated deterministically **before**
  the (separate, already-existing) Gemini analysis step — SerpApi volume
  never translates 1:1 into Gemini calls.

## Deduplication

Two layers, deliberately separate:

1. **Same-source, same-batch** (`lib/jobs/deduplicate.ts`) — keys on
   `source:sourceJobId` or a content hash
   (`source|title|company|location|applicationUrl`,
   `lib/jobs/normalize.ts#computeContentHash`). Enforced again at the
   database layer (`jobs.content_hash` and `jobs.(source, source_job_id)`
   unique indexes).
2. **Cross-source** (`lib/jobs/cross-source-dedupe.ts`) — the same real
   vacancy appearing under a DIFFERENT source (e.g. ITPro and a company's
   own careers page) always has a different content_hash by construction
   (it includes `source`), so this runs as a separate pass after storage:
   an exact `applicationUrl` match, or agreement on ALL of normalized
   company + normalized title + normalized location. Deliberately
   conservative — two different companies hiring for "Data Analyst Intern"
   never merge. Links the newer row to the existing one via
   `jobs.duplicate_of`; **never deletes either row**, so source provenance
   is preserved — the job detail page shows "Also listed on: X, Y" by
   querying siblings via that link.

## Job freshness

`jobs.first_seen_at` (set once, preserved across re-discovery),
`last_seen_at` (bumped every time a search re-encounters the listing), and
`posted_at` (from the source, when available) feed
`lib/jobs/freshness.ts#classifyFreshness` → `Fresh` (≤3 days) / `Recent`
(≤14 days) / `Older` / `Unknown`. `listing_status` (`active`/`stale`/
`closed`/`unknown`) exists in the schema for future use — no provider
currently signals closure, so nothing is automatically marked `closed` or
`stale` in Phase 9 (a real gap you shouldn't infer past — see
`docs/PROJECT_SPEC.md`'s Phase 9 entry).

## Ranking

`lib/jobs/rank.ts#rankJobs` — deterministic, primarily the candidate match
score, with a small bounded freshness nudge (±4 points max,
`freshnessAdjustment`) that can only break a near-tie, never let a
fresher-but-weaker match outrank a substantially stronger older one (a 95%
older match still beats a 65% fresh one). Chat's conversational results
additionally go through `selectChatResults` — at most 5, only ones
clearing a 60% quality floor, never padded with weak matches just to hit a
round number (falls back to the best few, honestly flagged, only when
almost nothing clears the floor).

## Storage & write access

`jobs`, `job_skills`, `job_sources`, `job_source_runs` are global/shared
tables — every authenticated user can `SELECT`, but there is deliberately
**no** `INSERT`/`UPDATE`/`DELETE` policy for the `authenticated` role at
all (default deny). Ingestion (`lib/jobs/discovery.ts`) writes through the
service-role admin client (`lib/supabase/admin.ts`), from trusted
server-side code only.

## Security

- **SSRF** (`lib/jobs/url-safety.ts`): every server-side fetch of an
  external URL (company career pages, a pasted job URL) is checked first —
  `https://` only, blocks `localhost`/loopback/private IPv4 ranges
  (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and the cloud metadata
  address (`169.254.169.254`), re-validates after redirects, enforces an 8s
  timeout and a 2MB response cap.
- **robots.txt**: checked before every such fetch (`isAllowedByRobotsTxt`)
  — fails closed (treats an unfetchable robots.txt as disallowing access,
  never the reverse).
- **Prompt injection**: job listing text (from any source) is passed to
  Gemini as explicitly-labeled untrusted data — see `docs/AI_AGENT.md`.
- **URL validation**: `applicationUrl`/`sourceUrl` require `https://`
  (`NormalizedJobSchema`), rejecting `javascript:`/`data:`/`file:` and
  similar by construction.

## Rate limiting & caching

No Redis/queue — in-process only. ITPro: 5-minute response cache. SerpApi:
5-minute response cache keyed by exact query+location, plus bounded query
expansion (see "Cost protection" above). robots.txt: 30-minute per-origin
cache. Job analysis: gated by existing `job_skills` rows per job, never
re-run for an unchanged listing. Company-careers fetches run concurrently
per search (`Promise.allSettled`) but are bounded by however many sources
are configured (currently zero).

## Manual import ("paste a job URL")

`lib/jobs/providers/company-careers.ts#importJobFromUrl` — the shared
mechanism behind the `/jobs` page's "Got a job URL?" box. SSRF- and
robots.txt-checked like any other fetch; extracts schema.org JobPosting
if present, stores it through the same pipeline as a discovered job
(`storeImportedJob`), giving it a real `jobId` usable for matching/CV
tailoring/saving. When the page has no structured data (LinkedIn,
XpressJobs, ikman, most company pages), it fails honestly and points the
user at pasting the job description in chat instead — never fabricates a
result.
