# WSO2 API Manager Integration

**Status: code and configuration prepared; WSO2 live invocation NOT
verified in this environment.** WSO2 API Manager was not installed or
started here — see [Part 35 note](#part-35-honest-status) below. This
document is both the design explanation and the manual checklist for
completing the WSO2 side yourself, per the project's own evaluation
requirements.

## 1. Why WSO2

CareerLens's backend is currently only reachable via the browser app's
own cookie-authenticated pages and `/api/chat`. WSO2 API Manager adds a
proper **API management layer** in front of a new, stable, versioned REST
surface (`/api/v1`) — OAuth2-protected access for external clients, rate
limiting (especially important since several endpoints call Gemini,
which costs real money per request), API versioning/lifecycle management,
a developer portal for API consumers to discover and subscribe, and usage
analytics. It does **not** replace anything already working — see
[§15](#15-wso2-vs-supabase-authentication-responsibilities).

## 2. Architecture

```text
External Client (web/mobile/other services)
        |
        v
  WSO2 API Manager
  - OAuth2 / JWT (of the API CONSUMER, not a specific human)
  - Subscriptions
  - Rate limiting
  - Versioning
  - Analytics
        |
        v
  CareerLens /api/v1  (this repo, Next.js Route Handlers)
  - Verifies a Supabase user access token per-request (bearer, not cookie)
  - Never trusts a client-supplied profile_id/user_id
        |
   +----+----+----+
   |    |    |    |
   v    v    v    v
Profile Resume Jobs Applications
   \    |    |    /
    v   v    v   v
      CareerLens Core
       /          \
      v            v
  Supabase       Gemini
```

The existing streaming `/api/chat` (NDJSON, cookie-authenticated,
conversational state) is **untouched** and deliberately **not** put
behind WSO2 in this phase — WSO2's gateway model is built around
request/response HTTP semantics, not a long-lived streaming connection
tied to a browser session; putting it behind WSO2 without first solving
identity/session propagation would risk breaking the live chat product
for no real benefit yet.

## 3. API catalogue

One versioned API — **CareerLens API v1.0.0**, WSO2 context
`/careerlens/1.0.0`, backend `http://localhost:3000/api/v1` (or
`http://host.docker.internal:3000/api/v1` if WSO2 runs inside Docker).

Full machine-readable definition: [`docs/openapi.yaml`](openapi.yaml) —
27 paths across 22 route files, matching **exactly** what's implemented
(validated against the built routes; nothing documented that doesn't
exist, per Part 19).

| Group | Endpoints |
| --- | --- |
| Health | `GET /health` (public) |
| Career Profile | `GET/PUT /profile`, `GET /profile/{skills,education,experience,projects,preferences}` |
| Resume Intelligence | `GET /resumes`, `GET/DELETE /resumes/{id}`, `GET /resumes/{id}/analysis`, `POST /resumes/{id}/analyze` |
| Job Discovery | `GET /jobs`, `GET /jobs/{id}`, `POST/DELETE /jobs/{id}/save`, `GET /jobs/saved` |
| Job Matching | `POST /jobs/search`, `POST /jobs/match` |
| Application Optimization | `GET/POST /applications`, `GET/PATCH/DELETE /applications/{id}`, `POST /applications/{id}/analyze`, `POST /applications/{id}/tailor-cv`, `POST /applications/{id}/cover-letter`, `POST /applications/{id}/ats-analysis` |
| Career AI | `POST /ai/career-analysis` |
| Interview | `POST /interview/questions`, `POST /interview/answer-review`, `POST /interview/company-prep` |

If you publish these to the WSO2 Developer Portal as separate logical
products (Part 25's suggested grouping — "Career Profile API", "Resume
Intelligence API", etc.), they can all still point at this ONE backend
API definition; WSO2 lets you group/relabel without duplicating the
backend contract.

### A known naming ambiguity, resolved

PROJECT_SPEC's Part 11 and Part 14 both describe a bare
`GET /applications/{...}`, but mean two different things by it: Part 14
means the `applications` tracking-table row id; Part 11 means a job id
(for the tailoring bundle). Next.js can't route the same path shape to
two different meanings. This API resolves it explicitly:

- `GET/PATCH/DELETE /applications/{id}` → `id` is the **applications
  table row id** (the tracking record).
- `POST /applications/{id}/analyze|tailor-cv|cover-letter|ats-analysis` →
  `id` is a **job id** (Part 11's tailoring flow — `getOrCreateApplication`
  resolves/creates the underlying `application_documents` row itself).

## 4. Authentication (and §15: WSO2 vs. Supabase responsibilities)

Two layers, never conflated:

1. **WSO2 authenticates the API consumer** (an application, via OAuth2 —
   client-credentials for service-to-service testing, or another WSO2
   grant type for a real client app) — enforced entirely by the gateway,
   in front of this backend. A WSO2-issued token proves "this is a
   registered, subscribed application," **never** "this is a specific
   human." This backend does not re-implement or verify WSO2 tokens at
   all — that verification never reaches this codebase; it happens at
   the gateway.
2. **This backend separately requires a genuine Supabase user access
   token** for every endpoint except `/health`, sent as
   `Authorization: Bearer <token>` — see `lib/api/auth.ts`. This is the
   exact same Supabase Auth system the browser app already uses (cookie
   for the browser, bearer token for a non-browser API client) — not a
   new identity system, not WSO2's OAuth2 token. `getUser(token)` is
   called against Supabase's own Auth server on every request; there is
   no caching or local-only verification that could go stale.

**Nothing in `/api/v1` ever trusts a client-supplied `profile_id` or
`user_id`.** Every route derives the owner exclusively from the verified
bearer token (`lib/api/auth.ts#authenticateApiRequest`) — there is no
parameter, header, or body field anywhere in this API that lets a caller
specify whose data to read or write.

**For genuinely user-specific endpoints (profile, resumes, applications,
etc.), a real Supabase user token is required — there is no way around
this, and the spec's own Part 16 anticipates it**: "For initial external
API testing, use non-user-specific endpoints such as `GET /health`... For
user-specific APIs, require a proper identity strategy." This document
IS that strategy. `GET /health` is the only endpoint that works with
nothing but a valid WSO2-issued token (or no token at all, if WSO2 itself
is bypassed in local testing) reaching the gateway.

**How to get a real Supabase user token for testing:** sign in through
the actual CareerLens web app, or call Supabase's own auth REST API
directly (`POST {SUPABASE_URL}/auth/v1/token?grant_type=password` with a
real email/password and the `apikey` header set to the anon key) — the
`access_token` in that response is what goes in `/api/v1`'s
`Authorization: Bearer` header. Never the WSO2 OAuth2 token from §7 below
— that token only gets a request *through the gateway*; it carries no
CareerLens user identity at all.

## 5. Reuse vs. new code — an honest architectural note

Read (`GET`) endpoints call the EXISTING data-fetching functions directly
(`getCareerProfile`, `getResumesForUser`, `getJobWithMatch`, etc.) — those
already accept an explicit `userId` parameter and need no cookie session,
so they're genuinely reused as-is, zero duplication.

Write endpoints could **not** directly call the existing cookie-based
Server Actions (`updateBasicProfile`, `trackApplication`,
`generateTailoredCv`, etc.) — those all derive their user internally via
`getOptionalUser()`, which reads Next.js's request-scoped cookie jar and
is unavailable to a bearer-token API caller with no browser session.
Rather than duplicating the real business logic (Gemini prompts,
VerifiedFacts grounding, deterministic comparison, notification side
effects), each affected action was refactored into a thin cookie-based
wrapper plus an exported `*Core(userId, supabase, ...)` function — the
wrapper resolves the cookie session and delegates, so the web app's
behavior is byte-for-byte unchanged, and `/api/v1` calls the exact same
core logic with its own bearer-token-resolved `userId`/`supabase`. See
`processResumeCore`, `runApplicationAnalysisCore`,
`generateTailoredCvCore`, `generateCoverLetterForApplicationCore`,
`getOrCreateApplicationCore`, `trackApplicationCore`,
`updateApplicationStatusCore`, `startInterviewSessionCore`,
`submitInterviewAnswerCore`, `searchJobsCore`.

Trivial single-statement writes (save/unsave a job, the profile PUT's
plain column updates) were implemented directly against the bearer-token-
scoped RLS client instead — there was no meaningful logic to preserve,
just a table write, so a `*Core` extraction would have been pure
ceremony.

## 6. Rate limiting (WSO2-enforced, not application-level)

This backend does not implement its own rate limiting — that's WSO2's
job, per PROJECT_SPEC's own instruction ("WSO2 should enforce the
API-level/application-level limits... not hardcoded application-level
limits"). Suggested starting throttling tiers, configured in the WSO2
Publisher against this API's resources:

| Group | Suggested limit | Why |
| --- | --- | --- |
| `GET /health` | 1000/min | Cheap, no DB/AI call |
| Profile reads | 100/min | Simple DB reads |
| `POST /jobs/search` | 100/min | Real provider calls (ITPro/SerpApi), but no Gemini |
| Resume reads/list | 50/min | DB reads |
| `POST /resumes/{id}/analyze` | 50/min | One Gemini call |
| Application tracking (CRUD) | 30/min | DB writes |
| `POST /ai/career-analysis` | 10/min | Gemini-powered |
| `POST /applications/{id}/tailor-cv` | 10/min | Gemini-powered |
| `POST /applications/{id}/cover-letter` | 10/min | Gemini-powered |
| `POST /interview/*` | 10/min | Gemini-powered |

## 7. OAuth2 test (Client Credentials flow)

```bash
# 1. Get a WSO2 application access token (proves "a registered app is calling")
curl -k \
  -u "CONSUMER_KEY:CONSUMER_SECRET" \
  -d "grant_type=client_credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  https://localhost:9443/oauth2/token

# 2. Call the gateway-fronted health check
curl -k \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  https://localhost:8243/careerlens/1.0.0/health
# Expected: 200 OK

# 3. Call a user-specific endpoint (needs a REAL Supabase user token too — see §4)
curl -k \
  -H "Authorization: Bearer WSO2_ACCESS_TOKEN" \
  -H "X-Supabase-Authorization: Bearer SUPABASE_USER_TOKEN" \
  https://localhost:8243/careerlens/1.0.0/profile
```

Note on step 3: WSO2's own gateway forwards the `Authorization` header it
received to the backend by default, which this backend expects to be the
**Supabase** token (§4) — not the WSO2 token. If you configure WSO2 to
also require its own OAuth2 header, you'll need either a custom header
mapping (e.g. forward the Supabase token as `Authorization` and the WSO2
token separately) or a WSO2 "Pass Through" policy — decide this when you
actually wire up the gateway; it's a WSO2 configuration choice, not
something this backend needs to change for.

## 8. Versioning

Current: `/careerlens/1.0.0`. A future breaking change ships as
`/careerlens/2.0.0` alongside it (WSO2 supports both simultaneously) —
existing consumers of 1.0.0 are never broken by a 2.0.0 release.

## 9. Developer Portal

Once published, the WSO2 Developer Portal should show: API name/
description, version, the resource list (from `docs/openapi.yaml`),
authentication requirements (§4), how to subscribe, the throttling tier
(§6), and example requests/responses (already in the OpenAPI spec's
`requestBody`/`responses`).

## 10. API subscription lifecycle

```text
Created (Publisher: import docs/openapi.yaml)
    -> Deployed (a gateway environment)
    -> Published (visible in Developer Portal)
    -> Subscribed (an Application, e.g. "CareerLens Web Application",
       subscribes to a tier)
    -> Invoked (OAuth2 keys generated for that Application, §7)
```

## 11. Local development

1. `npm run dev` — starts CareerLens on `http://localhost:3000`.
2. Verify `/api/v1/health` works directly first (bypassing WSO2), to
   isolate backend issues from gateway issues:
   ```bash
   curl http://localhost:3000/api/v1/health
   ```
3. Start WSO2 API Manager (Docker or a local install — not covered by
   this repo; see WSO2's own documentation for your platform).
4. Follow §12 to configure the backend URL correctly for how WSO2 is
   running.

## 12. WSO2 configuration

- **Docker**: backend URL `http://host.docker.internal:3000/api/v1`
  (container needs to reach the host machine).
- **WSO2 running directly on the host**: backend URL
  `http://localhost:3000/api/v1`.
- Import `docs/openapi.yaml` in the Publisher's "Create API → Import Open
  API Definition" flow — it already matches the real, implemented
  resource list exactly.

## 13. API invocation examples

See `docs/openapi.yaml`'s per-endpoint `requestBody`/`responses`
sections, and §7 above for the OAuth2 flow.

## 14. Security considerations

- `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — server-only, never
  referenced in any `/api/v1` or `lib/api/` file except where the
  existing server-only patterns already use them (verified — see §16's
  audit below).
- Errors never leak a raw exception message, stack trace, or database
  error to the client — `lib/api/handler.ts`'s catch-all always returns a
  generic `INTERNAL_ERROR`; the real error is logged server-side
  (message only) via `lib/api/log.ts`.
- Request logging (`lib/api/log.ts`) captures request id, endpoint,
  method, status, and latency **only** — never resume text, cover letter
  content, CV content, email, phone, tokens, or API keys; those simply
  never pass through that function's parameters, so there's no path for
  them to leak into logs.
- Job listing text (titles, descriptions) from external providers is
  treated as untrusted data throughout the existing pipeline (unchanged
  by this phase) — the existing prompt-injection defenses in
  `lib/ai/prompts.ts` and job-analysis prompts already cover this; no new
  surface was introduced here.
- Resume responses never include raw extracted CV text or the private
  Storage path (`lib/api/serialize-resume.ts`, unit-tested).
- Generated CV/cover-letter content is only ever produced through the
  existing VerifiedFacts-grounded pipeline (§5) — never a new, ungrounded
  generation path.

## 16. Security audit performed

```bash
grep -rn "GEMINI_API_KEY\|SUPABASE_SERVICE_ROLE_KEY\|consumer.secret\|client_secret\|access_token" \
  app/api/v1 lib/api lib/agent-state lib/chat 2>/dev/null
```

Result: no hardcoded secrets found in any new file. The only
`SUPABASE_SERVICE_ROLE_KEY` reference in the whole repo remains
`lib/supabase/admin.ts` (pre-existing, used only for global job
ingestion, unrelated to `/api/v1`). No `/api/v1` route imports the
service-role client at all — every route is scoped to the RLS-enforced
anon-key + bearer-token client.

## Part 35 honest status

WSO2 API Manager was **not installed, started, or configured** in this
environment. Docker is available (`docker --version` confirmed 24.0.5),
but installing and booting a full WSO2 API Manager instance, then
manually configuring it through its Publisher/Developer Portal UI, is an
inherently interactive process (PROJECT_SPEC's own Part 34 checklist is
phrased as "I need to manually verify," addressed to you, not something
an agent should attempt unattended) — and genuinely outside what's
appropriate to run unsupervised in this session regardless.

**What IS verified, live, in this environment**: the actual `/api/v1`
backend — 22 route files, 27 documented paths, real Supabase JWT
verification (confirmed against the live project — an invalid token
takes a real ~1.2s round-trip to Supabase's Auth server and is correctly
rejected), correct 401 behavior with and without a token, `/health`
correctly public, `proxy.ts` correctly leaving `/api/v1/*` alone (an API
route returns JSON errors, never an HTML login-page redirect).

**What is NOT verified**: anything that requires WSO2 actually running —
the full Publisher → Developer Portal → Subscribe → OAuth2 → Invoke
chain (§10), the 429 rate-limit demonstration (§6/Part 28), and WSO2
analytics (Part 29). Complete PROJECT_SPEC's own Part 34 checklist
yourself, using `docs/openapi.yaml` for step 4 and this document's §7 for
the OAuth2 test — the backend it points at is real and already working.

## Evidence to collect for evaluation

Per PROJECT_SPEC's Part 36: screenshot the WSO2 Publisher (API created,
version 1.0.0, the resource list from `docs/openapi.yaml`), the backend
endpoint configuration, the Developer Portal listing, the subscription +
OAuth2 credentials screen (**mask the consumer secret**), a successful
`/health` call (200), a call with no/invalid token (401), a rate-limited
call once you've configured a low throttling tier for testing (429), and
WSO2's analytics dashboard if enabled. Never screenshot a real Supabase
access token, service-role key, or Gemini key — even partially visible in
a terminal scrollback.

## Evaluator explanation (as written, verbatim per PROJECT_SPEC)

> I integrated WSO2 API Manager into CareerLens AI as an API management
> and security layer. WSO2 acts as the gateway between external clients
> and the CareerLens backend, providing OAuth2-protected API access,
> subscriptions, rate limiting, API versioning, lifecycle management, and
> analytics. CareerLens exposes career profile, resume intelligence, job
> discovery, job matching, application optimization, and AI-powered
> career services through versioned APIs.

WSO2 does not replace Supabase Auth, does not replace Gemini, and does
not perform the AI matching itself — WSO2 manages and protects the APIs;
CareerLens performs the actual career intelligence.

## Known limitations

- `POST /interview/questions`'s `mode` field is accepted but not yet used
  to filter question categories (the underlying `generateInterviewQuestions`
  doesn't take a category filter today).
- `POST /interview/company-prep` is deliberately the same underlying
  mechanism as `/interview/questions` with a required `jobId` — there is
  no separate company-research capability.
- `companyType`/`industry`/`international` search filters are honest
  keyword augmentation, not a precise structured-field filter — no job
  source provides a structured company-type/industry field (see
  `docs/JOB_DATA.md`).
- `GET /jobs` (browse) returns unmatched jobs — no per-candidate score;
  use `POST /jobs/search` or `POST /jobs/match` for a scored result.
- No automated test covers the full authenticated request/response body
  of every write route end-to-end (would require a real Supabase user in
  the live project, which doesn't exist yet — see the Phase 21 report's
  identical, longstanding limitation). The auth boundary (401 without a
  token) IS tested for every route that can be safely imported under this
  project's Vitest setup — see `app/api/v1/auth-boundary.test.ts`'s own
  header comment for the one disclosed, technical reason a subset of
  routes aren't included there.
