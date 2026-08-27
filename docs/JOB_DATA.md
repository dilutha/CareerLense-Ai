# Job Data

Status: provider architecture implemented (Phase 7). **Only one provider is
currently active: the demo/fixture provider** — no real job-search API
credential is configured (`JOB_SEARCH_API_KEY` unset). Every job the app
shows right now is clearly fictional demo data; see below for what it
would take to turn on a real source.

## Architecture

```text
JobDiscoveryService (lib/jobs/discovery.ts)
        │
        ├── demo (lib/jobs/providers/demo.ts)         — active by default
        ├── search (lib/jobs/providers/search-provider.ts) — stubbed, inactive
        └── future providers (TopJobs, XpressJobs, ikman Jobs, company pages, ...)
```

`lib/jobs/providers/index.ts#getActiveProviders()` selects providers by
`JOB_SEARCH_PROVIDER` (defaults to `demo`). The matching engine
(`lib/jobs/match.ts`) and everything downstream only ever operate on the
common `NormalizedJob` shape (`lib/jobs/schemas.ts`) — they don't know or
care which provider a job came from.

## Provider status

| Provider | Method | Availability | Auth required | Notes |
| --- | --- | --- | --- | --- |
| `demo` | Fixture data | Always available | No | 5 fictional Sri Lankan listings (`demo.careerlens.lk`), clearly labeled `isDemo: true` end to end — UI badges every card from this provider "Demo data". Default when no real provider is configured. |
| `search` | Permitted web-search API (Tavily/Serper/Bing Web Search, TBD) | **Not implemented** | Yes (`JOB_SEARCH_API_KEY`) | Interface implemented in `lib/jobs/providers/search-provider.ts`, returns `status: "unavailable"` until real integration is built. When built, it should construct queries like `site:linkedin.com/jobs/view "Data Analyst" "Colombo"` against the search API — never scrape Google/LinkedIn HTML directly. |

### Sources evaluated but not integrated yet

| Source | Public access? | API? | Verdict |
| --- | --- | --- | --- |
| LinkedIn | Job *pages* are publicly indexed; the platform itself is not | No public job-search API for this use case | Only via a permitted search provider surfacing public `linkedin.com/jobs/view/...` pages — **never** authenticated scraping, login automation, or CAPTCHA/rate-limit evasion (hard rule, not just a preference). |
| TopJobs / XpressJobs / ikman Jobs | Listings are public web pages | No public API found | Candidate for a future provider via either a permitted search API or, if their terms allow it, direct fetching of public listing pages — needs a terms-of-service check before implementation, not assumed here. |
| Company career pages | Public | No general API | Often the most reliable source long-term; a future provider per company/ATS (Greenhouse, Lever, etc. do have APIs) rather than one crawler. |

## Deduplication

`lib/jobs/deduplicate.ts` keys on `source:sourceJobId` when a provider
supplies one, falling back to a content hash
(`lib/jobs/normalize.ts#computeContentHash`) of
`source|title|company|location|applicationUrl` — never on title alone, so
two different companies hiring for "Data Analyst Intern" are never merged.
The database also enforces this at the storage layer (`jobs.content_hash`
and `jobs.(source, source_job_id)` unique indexes).

## Storage & write access

`jobs` and `job_skills` are global/shared tables — every authenticated
user can `SELECT`, but there is deliberately **no** `INSERT`/`UPDATE`/`DELETE`
policy for the `authenticated` role at all (default deny). Ingestion
(`lib/jobs/discovery.ts`) writes through the service-role admin client
(`lib/supabase/admin.ts`), from trusted server-side code only — never from
a request the browser controls directly.

## Skill/requirement extraction

Each newly-stored job is analyzed once by Gemini
(`lib/jobs/analyze-job.ts`) to extract skills (with required/preferred/
nice-to-have distinction), education requirements, experience level, and
keywords — gated by whether `job_skills` rows already exist for that
`job_id`, so the same listing is never re-analyzed on a later search (see
`docs/AI_AGENT.md`).

## LinkedIn specifically

CareerLens does not, and will not, automate LinkedIn login, bypass
CAPTCHA/anti-bot mechanisms, or scrape authenticated content. The only
legitimate paths are: (1) a permitted search API surfacing public
`linkedin.com/jobs/view/...` pages (not implemented — see `search`
provider above), or (2) the user pasting a LinkedIn job description
directly into chat for analysis (already supported — see
`docs/AI_AGENT.md`'s conversational job-description analysis).
