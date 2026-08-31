# WSO2 API Platform Integration

Status: **a real, live WSO2 API Platform gateway is deployed and
integrated** — this is a different, later state than
[`WSO2_API.md`](WSO2_API.md), which documents the `/api/v1` REST API
*contract* designed to sit behind a gateway, written when no WSO2
instance existed to test against. This document covers the actual,
live gateway now in front of that same API, and the code that calls
through it in real production traffic — not a mock, not a test page.

**Live-verified this session, using the real credentials and the actual
`lib/wso2/` code (not a hand-written replica) — see §19 for the full
evidence:**
- ✅ `GET /health` through WSO2 — genuine success, HTTP 200, real body.
- ⚠️ `GET /profile` through WSO2 — the request reaches WSO2 and gets
  forwarded to this backend (confirmed by receiving this backend's own
  error format back, not a WSO2-level rejection), but the end-user's
  bearer token isn't arriving at the backend intact — see §19. This is a
  WSO2 gateway configuration matter (the "Pass User Context to Backend"
  policy), not a code defect; `getCareerProfileViaWso2OrDirect` already
  falls back to the direct Supabase call when this happens, so
  `/profile` still works correctly for real users today — it just isn't
  routing through WSO2 for that data yet.

## 1. Why WSO2 is used

CareerLens's `/api/v1` REST API (health, profile, resumes, jobs,
applications, AI career-analysis, interview — see
[`openapi.yaml`](openapi.yaml)) was built from the start to be managed by
an API gateway rather than called directly: WSO2 is the layer responsible
for API-consumer authentication, rate limiting, and CORS, so this
backend never has to reimplement any of that — it only ever has to
verify *which real user* a request is for (see §3).

## 2. API endpoint

```
WSO2_API_BASE_URL = https://<your-gateway-id>-dev.e1-us-east-azure.bijiraapis.dev/careerlense-ai/careerlens-rest-api/v1.0
```

Confirmed live this session with a direct, unauthenticated probe:

```
$ curl https://<gateway>/careerlense-ai/careerlens-rest-api/v1.0/health
{"error_message":"Invalid Credentials","code":"900901","error_description":"Make sure you have provided the correct security credentials"}
HTTP 401
```

That `900901` response is WSO2's own standard "missing/invalid
subscription key" error — proof the gateway itself is live and
correctly enforcing security before ever reaching this backend's code.

## 3. Authentication — two independent layers, never conflated

Every request this app sends to WSO2 carries up to two separate
credentials, each proving something different:

| Layer | Credential | Proves | Verified by |
|---|---|---|---|
| API consumer (gateway) | `WSO2_API_KEY`, sent as the header named by `WSO2_API_KEY_HEADER` (commonly `apikey`) | "this is the real CareerLens server calling, a registered API consumer" | WSO2 itself, entirely at the gateway — this backend never re-checks it |
| End user | A real Supabase user access token, forwarded as `Authorization: Bearer <token>` | "this is a specific, signed-in CareerLens user" | This backend's own `/api/v1` routes (`lib/api/auth.ts`), completely independently of WSO2 |

A valid WSO2 API key only proves the *server* is allowed to reach the
gateway — it says nothing about which end user a request is for, and is
never treated as such. `/api/v1/profile` (and every other user-scoped
route) still requires and independently verifies a real Supabase bearer
token, exactly as it did before WSO2 was ever added — see
[`WSO2_API.md`](WSO2_API.md)'s §4 for that layer's full detail, unchanged
here.

**Security header name**: intentionally not hardcoded — read from
`WSO2_API_KEY_HEADER` (`lib/wso2/client.ts`), because the exact header
your WSO2 Developer Portal's "Get Test Key" screen shows is something
only you can see, not something this codebase should guess.

## 4. Environment variables

Server-side only, none prefixed `NEXT_PUBLIC_*`:

| Variable | Required | Purpose |
|---|---|---|
| `WSO2_API_BASE_URL` | For WSO2 to be used at all | The gateway's base URL (dev vs. production point to different WSO2-issued URLs) |
| `WSO2_API_KEY` | Same | The subscription/test key from your Developer Portal |
| `WSO2_API_KEY_HEADER` | No — defaults to `apikey` | Only needed if your portal shows a different header name |

When either `WSO2_API_BASE_URL` or `WSO2_API_KEY` is unset,
`isWso2Configured()` (`lib/wso2/client.ts`) returns `false` and every
caller falls back to calling Supabase directly — the app keeps working
without WSO2 configured, it just doesn't route through the gateway.

## 5. Request flow (real, not diagrammed-only)

```
Browser (signed-in user)
   │
   ▼
Next.js Server Component (e.g. app/profile/page.tsx)
   │  getCareerProfileViaWso2OrDirect(userId)
   ▼
lib/wso2/profile.ts#getProfileViaWso2(userAccessToken)
   │  callWso2("/profile", { userAccessToken })
   ▼
lib/wso2/client.ts#callWso2
   │  headers: { apikey: WSO2_API_KEY, Authorization: "Bearer <user JWT>", X-Correlation-ID }
   ▼
WSO2 API Platform gateway  ── verifies apikey, applies rate limiting/CORS ──▶
   │
   ▼
GET /api/v1/profile  (this app's own existing route, unchanged)
   │  authenticateApiRequest(request) — verifies the Supabase bearer token independently
   ▼
Supabase (RLS-scoped to that user)
   │
   ▼
Response flows back up through WSO2 → callWso2 → the page → the browser
```

## 6. Which CareerLens operations go through WSO2

Wired to a **real production code path** this session, not a demo:

- **`app/profile/page.tsx`** — every load of `/profile` by a signed-in
  user calls `getCareerProfileViaWso2OrDirect`, which routes through WSO2
  when configured (falling back to the direct call on any WSO2 failure —
  see §11).
- **`GET /api/wso2-status`** (`app/api/wso2-status/route.ts`) — a
  signed-in diagnostic endpoint that calls both `GET /health` and
  `GET /profile` through WSO2 on demand, for verification/demonstration
  (§13).

Other `/api/v1` routes are already reachable through the same gateway by
any external API consumer (that's the whole point of putting `/api/v1`
behind WSO2 in the first place — see `WSO2_API.md`); this session's work
is specifically about CareerLens's *own* Next.js server also using that
same path for its own first-party pages, rather than only external
consumers benefiting from it.

**Defined but not wired into any real page/flow** (`lib/wso2/profile.ts`
exports these; grepped the whole repo for callers and found none outside
that file itself): `getSkillsViaWso2`, `getEducationViaWso2`,
`getExperienceViaWso2`, `getProjectsViaWso2`, `updateProfileViaWso2`. The
WSO2-capable client function exists for each, but the actual
skills/education/experience/projects sections on `/profile` and every
profile-editing Server Action still call `lib/career-profile/actions.ts`
directly against Supabase, not through WSO2. Recorded here so this table
never claims more coverage than the code actually has — wiring these up
would be a real, separate follow-up, not something to silently assume.

| Operation | WSO2? | Evidence |
|---|---|---|
| `GET /health` | **Yes** | `app/api/wso2-status/route.ts` → `healthCheckViaWso2` |
| `GET /profile` (read) | **Yes** | `app/profile/page.tsx` → `getCareerProfileViaWso2OrDirect` → `getProfileViaWso2`; also `app/api/wso2-status/route.ts` |
| `PUT /profile` (update) | No | `updateProfileViaWso2` exists, zero callers — profile edits go straight to Supabase via `lib/career-profile/actions.ts` |
| `GET /profile/skills` | No | `getSkillsViaWso2` exists, zero callers |
| `GET /profile/education` | No | `getEducationViaWso2` exists, zero callers |
| `GET /profile/experience` | No | `getExperienceViaWso2` exists, zero callers |
| `GET /profile/projects` | No | `getProjectsViaWso2` exists, zero callers |
| Chat (`/api/chat`) | No — by design | Grepped `app/api/chat/route.ts` and `lib/ai/`: no WSO2 import anywhere. Chat talks to Gemini + Supabase directly; WSO2 fronts the CareerLens REST API layer, not third-party AI calls (§1.6 of the product spec this section answers) |
| Job discovery (ITPro/SerpApi/company-careers) | No — by design | Grepped `lib/jobs/`: the only WSO2-adjacent text is "WSO2" as a *candidate company name* once checked as a potential career-page source (unrelated to the API gateway) |

`getCareerProfileViaWso2OrDirect` now returns `{ profile, transport }` where
`transport` is `"wso2" | "direct" | "not_configured"` — the caller (or
anything instrumenting it later) can tell "WSO2 actually served this" from
"fell back to direct Supabase" without re-deriving it from log lines.

## 7. Rate limiting

Enforced by WSO2 itself, at the gateway — not duplicated in this
backend. See `WSO2_API.md`'s §7 for the originally-suggested tier table;
confirm your Developer Portal's actual configured throttling policy
matches your expectations for `/health` vs. the Gemini-backed routes.

## 8. Monitoring

- **This app's own server logs** — every WSO2 call logs one line via
  `lib/wso2/client.ts#logWso2Request`: correlation ID, path, method,
  status, latency, and (on failure) the error category. Search server
  logs for `[wso2]`. Never logs the API key, the bearer token, or
  response bodies.
- **WSO2's own Developer Portal / API analytics** — every real request
  this app sends appears there too, independently of this app's logs
  (§13, §15).

## 9. Error handling

`lib/wso2/errors.ts` defines typed categories (`CONFIG_ERROR`,
`AUTH_ERROR`, `UPSTREAM_UNAUTHORIZED`, `RATE_LIMIT_ERROR`,
`TIMEOUT_ERROR`, `UPSTREAM_ERROR`, `NETWORK_ERROR`, `VALIDATION_ERROR`),
each distinguished by response shape/status — WSO2's own gateway
rejection (`{"code":"900901","error_message":...}`, confirmed live) is
told apart from this backend's own `/api/v1` error envelope
(`{"success":false,"error":{"code":...}}`), which matters: an `AUTH_ERROR`
means the WSO2 key is wrong; an `UPSTREAM_UNAUTHORIZED` means the *user's*
session is invalid — very different fixes. A single bounded retry
(`retryOnFailure`) applies only to idempotent `GET` requests on a 5xx or
network failure, never to a write.

## 10. How to test

```bash
npm test -- lib/wso2/client.test.ts
```

15 unit tests, mocking `fetch`, covering: missing-config short-circuit,
correct header forwarding (both the configurable API-key header and the
user's bearer token), every error-category mapping above (including the
exact live-confirmed WSO2 rejection shape), the single-GET-retry
behavior, and that a non-GET request never retries.

## 11. How to demonstrate WSO2 usage

1. Add `WSO2_API_BASE_URL`, `WSO2_API_KEY` (and `WSO2_API_KEY_HEADER` if
   not `apikey`) to `.env.local` (or Vercel's environment variables for
   production).
2. Sign in, then visit `GET /api/wso2-status` — it returns a JSON summary
   of a real `/health` and `/profile` call made through WSO2 just now,
   e.g. `{"configured":true,"health":{"ok":true,"status":"healthy","latencyMs":143},"profile":{"ok":true,"found":true,"latencyMs":210},...}`.
3. Check this app's server logs for the matching `[wso2] <correlationId> GET /health -> 200 (143ms)` lines.
4. Check your WSO2 Developer Portal's API analytics/traffic view for the
   same requests, arriving at the same time.
5. Visit `/profile` itself while signed in — that's the real page users
   see, now genuinely fetching through the same gateway.

## 12. How to verify requests in WSO2

In your WSO2 Developer/API Publisher Portal: open the CareerLens API →
Analytics/Usage (naming varies by WSO2 product version) → you should see
request counts matching the timestamps of your `/api/wso2-status` calls
and `/profile` page loads.

## 13. How to verify API analytics

Same portal — look for per-endpoint latency and status-code breakdowns;
they should match this app's own logged `durationMs`/status values for
the same correlation-ID-tagged requests (correlation IDs are sent as
`X-Correlation-ID` on every request — check whether your WSO2 product
surfaces that header in its own trace view).

## 14. How to test unauthorized access

```bash
curl https://<your-gateway-url>/health
```

Expect `401` with WSO2's own `{"code":"900901","error_message":"Invalid Credentials",...}` body — confirmed live this session (§2). This
proves WSO2 itself rejects the request before it ever reaches this
backend.

## 15. How to test rate limiting

Send requests past your Developer Portal's configured throttling tier in
a short window (exact numbers depend on your policy — check the
Portal). WSO2 should respond `429`; this backend maps that to
`RATE_LIMIT_ERROR` (§9) rather than a generic failure. **Not live-tested
this session** — doing so deliberately would consume your real quota
against a live, possibly metered, API key.

## 16. Development vs. production configuration

`WSO2_API_BASE_URL` differs between environments (your dev gateway URL
vs. whatever production URL your WSO2 deployment publishes) — never
hardcoded in source, always read from the environment. Set the
appropriate value in `.env.local` for development and in Vercel's
environment variables for production (remember: Vercel env var changes
require a redeploy to take effect).

## 17. What was NOT changed

- Every other page/action in the app still calls Supabase directly, as
  before — only `/profile`'s read and the new diagnostic route were
  wired through WSO2 this session, deliberately, to keep the blast
  radius of a new external dependency small and provably safe (see §18).
- **This round, `lib/api/auth.ts` WAS changed** — see §20 — to fix the
  identity-propagation issue found in §19.

## 18. Honest limitations

- Rate-limit behavior (§15) is designed and mapped to a typed error but
  not exercised live, to avoid burning your real quota.
- WSO2's OAuth2/JWT mode (as opposed to the API-key mode confirmed live
  in §19) was not implemented — your actual header (`Test-Key`) and the
  live-confirmed WSO2 rejection shape both point to the API-key scheme,
  so that's what was built.
- **§20's fix for the §19 identity-propagation issue is code-complete
  and unit-tested, but NOT yet live-verified** — it requires a
  deployment to Vercel (WSO2 forwards to the production URL, not this
  local machine) before it can be exercised through the real gateway.
  Nothing in this session's tooling can trigger that deployment.

## 19. Live verification evidence (this session, real credentials)

**`GET /health` — genuine success**, run through the actual
`lib/wso2/client.ts`/`lib/wso2/profile.ts` code (not a hand-written
replica) with your real `.env.local` credentials:

```
isWso2Configured(): true
[wso2] 5fc08c37-... GET /health -> 200 (1179ms)
LIVE SUCCESS: {"service":"CareerLens AI","api":"v1","status":"healthy","timestamp":"2026-08-30T14:00:44.991Z"}
```

**`GET /profile` — reaches WSO2 and gets forwarded, but the user's
bearer token doesn't survive the trip.** Diagnosed precisely by creating
a temporary throwaway test user (never your real account — deleted
immediately after), signing in for a real Supabase access token, and
calling the *same* token two ways:

```
DIRECT (bypass WSO2, hit the backend on Vercel directly):
  404 {"success":false,"error":{"code":"NOT_FOUND","message":"No profile found for this account yet."}}
  -> the token itself IS valid (a 401 would mean an invalid token; a 404
     here just means this brand-new test user's profile row hadn't been
     created yet — an auth SUCCESS).

THROUGH WSO2 (identical token, same header):
  401 {"success":false,"error":{"code":"UNAUTHORIZED","message":"A valid Supabase access token is required."}}
  -> this is the BACKEND's own rejection message (proving WSO2 forwarded
     the request), meaning the Authorization header WSO2 forwarded was
     missing, empty, or altered — not the same token that was sent.
```

**What this means**: WSO2 is not passing the `Authorization: Bearer
<token>` header through to the backend unchanged. This is very likely
the "Pass User Context to Backend" policy you mentioned — check in your
WSO2 Publisher Portal whether that policy is actually applied to the
`/profile` (and other user-scoped) resources, and whether it's
configured to forward the client's original `Authorization` header
rather than replacing/consuming it (some WSO2 configurations reserve
`Authorization` exclusively for the gateway's own OAuth2 validation and
require a different header, e.g. `X-JWT-Assertion`, to carry the
original client token through — if that's the case here, tell me which
header your policy actually forwards it as, and `lib/wso2/client.ts`
just needs that header name instead of reusing `Authorization`).

This is a WSO2 console configuration question, not a code defect — the
same code that correctly sent the token, got a real WSO2-forwarded
response back. `getCareerProfileViaWso2OrDirect` already handles this
exact failure mode safely (falls back to the direct call, logs it), so
production is not broken by this — WSO2 just isn't carrying user
identity through yet.

## 20. Fix attempted: `X-Supabase-Token` fallback header

**Research**: WSO2's own documentation on passing end-user attributes to
the backend (`apim.jwt` in `deployment.toml`) confirmed this is a
gateway/deployment-level setting, and — even if enabled — it makes WSO2
generate its OWN JWT about the API consumer/subscriber, not pass through
the caller's original token unchanged. That ruled out relying on that
mechanism. The much simpler, more likely explanation, consistent with
every piece of live evidence gathered: WSO2 treats `Authorization` as a
reserved header for its own security-scheme validation (even in
API-Key/`Test-Key` mode) and does not forward a client-supplied value
under that same name to the backend.

**Fix implemented**: the user's Supabase access token now also travels
as `X-Supabase-Token` — a header WSO2 has no built-in reason to
intercept — in addition to `Authorization` (`lib/wso2/client.ts`).
`lib/api/auth.ts#extractBearerToken` now accepts either header, still
independently re-verifying whatever token arrives against Supabase
(`supabase.auth.getUser(token)`) — accepting it from an additional
header name doesn't weaken authentication, since nothing is trusted
without that check regardless of which header carried it.

**Status: code-complete, unit-tested (11 new tests across
`lib/api/auth.test.ts`), deployed to production (pushed to `main` at the
user's explicit request), but inconclusive on live re-verification — see
§21.**

## 21. The test API key expired mid-session — a separate, important finding

Re-running the exact same `GET /health` probe that returned a genuine
`200 healthy` earlier in this session (§19) — no code involved, no
change from before, the identical request — now returns WSO2's own
`900901 Invalid Credentials`, the same error as before any key was ever
configured:

```
$ curl -H "<your key header>: <the same key value from earlier>" <base>/health
{"error_message":"Invalid Credentials","code":"900901",...}
HTTP 401
```

This means **the API key itself stopped being accepted between the two
tests, for every request, regardless of headers** — confirmed by testing
three header combinations (`Authorization` only, `X-Supabase-Token`
only, both) and all three failing identically at the WSO2 gateway level,
not the backend. This is very likely because a WSO2 Developer Portal
**"Get Test Key"** token is deliberately short-lived (commonly ~60
minutes) — it's meant for interactive testing inside the Portal UI, not
for a real application's ongoing traffic.

**This makes §20's fix genuinely unverifiable right now** — I can't tell
whether `X-Supabase-Token` actually resolves the original
identity-propagation issue, because the credential itself is now also
invalid, which would cause a failure either way.

**Recommended production fix — not just "get a new test key" (it would
expire again the same way):** in your WSO2 Developer Portal, create a
real **Application**, subscribe it to the CareerLens API, and generate
that Application's own key/credentials (an API key issued to a
subscribed Application, or OAuth2 client-credentials, depending on what
your API's security scheme offers) — these are meant for real ongoing
traffic and don't carry the same short interactive-testing TTL as a bare
"Get Test Key" token. Once you have that, update `WSO2_API_KEY` in both
`.env.local` and Vercel's production environment variables, and tell me
— I'll immediately re-run the exact same live diagnostic (throwaway test
user, real token, through the real gateway) to give you a conclusive
answer on whether `X-Supabase-Token` actually fixed the original issue.

**If this fix does NOT resolve it**: that would mean WSO2 is also
stripping arbitrary custom headers, not just `Authorization` specifically
— in which case the remaining path is genuinely Portal-side: check
whether the `/profile` (and other user-scoped) API resources have any
header allow-list, mediation policy, or "Pass User Context to Backend"
setting that needs to explicitly include either `Authorization` or
`X-Supabase-Token` to reach the backend unmodified.

## 22. Re-verified in a later session — still §21's issue, not a new one

Ran the exact same live `GET /health` probe again this session (throwaway
Vitest file making a genuine network call through `callWso2`, deleted
immediately after, credential never printed):

```
[wso2] <correlation-id> GET /health -> 401 (1291ms) category=AUTH_ERROR
WSO2Error: Invalid Credentials
```

Identical failure mode to §21 — `900901 Invalid Credentials` at the
gateway, not this backend. The credential currently in `.env.local` is
still not being accepted. §21's diagnosis and recommendation (a real
Application-issued credential, not another "Get Test Key") stand
unchanged; nothing about this session's other work (§1.3's structured
logging, the operation table in §6, or the new `transport` metadata on
`getCareerProfileViaWso2OrDirect`) required or assumed a working
credential to build correctly — they're all exercised by the header-
forwarding/fallback logic regardless of whether the specific key is
currently valid, and were verified structurally (code path, log output
shape) rather than by a successful authenticated response.

## 23. New credentials configured — briefly worked, then failed the same way again, AND a real, separate, more important bug found underneath

`.env.local` was updated with new WSO2 credentials this session. Re-ran
the full live diagnostic (throwaway Supabase test user, real access
token, genuine network calls, cleaned up immediately after):

1. **`GET /health` — succeeded**: `200 {"status":"healthy",...}`. The new
   credential genuinely worked, at least briefly.
2. **`GET /profile` through WSO2 with the real user's token — failed**:
   `404 "No profile found for this account yet."` — a *different* failure
   shape than any prior session (not `401 Invalid Credentials`, not the
   old "valid Supabase access token is required" message).
3. Investigated whether this was a WSO2 problem — **it was not**. Seeded
   a real `profiles` row for the test user and confirmed via a direct
   admin-client DB read that it genuinely existed, then called the exact
   same `/api/v1/profile` route **directly over HTTP, with WSO2 completely
   out of the loop** (`http://localhost:3011/api/v1/profile`,
   `Authorization: Bearer <token>`) — **same 404**, proving the bug lived
   entirely in this backend, not the gateway or the identity-propagation
   headers.
4. **Root cause**: `lib/career-profile/get-profile.ts#getCareerProfile`
   always built its own client via `createServerSupabaseClient()` — the
   cookie-session client, correct for browser page loads, but *always
   anonymous* for a bearer-token-only API caller (no session cookie
   exists on that kind of request at all). An anonymous client under RLS
   returns zero rows for any user, indistinguishable from "this user
   really has no profile." Every `/api/v1/profile*` GET route (profile,
   skills, education, experience, projects, preferences) and
   `/api/v1/ai/career-analysis` called `getCareerProfile(auth.userId)`
   this way — all seven were affected, regardless of WSO2. Notably, this
   same route's own `PUT` handler was already correct: it writes through
   `auth.supabase` (the bearer-token-authenticated, RLS-scoped client
   `authenticateApiRequest` already builds), just never handed that same
   client to the GET path's read.
5. **Fixed**: `getCareerProfile` now accepts an optional `client` param
   (defaults to the old cookie-based behavior — zero change for the many
   browser-session callers). All seven affected routes now pass
   `auth.supabase`. Re-verified live: the direct (non-WSO2) call to
   `/api/v1/profile` now returns a genuine `200` with the correct
   profile, `id` matching the test user.
6. **Then, independently, the WSO2 credential stopped being accepted
   again** — re-running the exact same `/health` and `/profile` probes a
   few minutes later returned `401 Invalid Credentials` for both,
   consistently across a retry. This is the same short-TTL "Get Test Key"
   pattern from §21, now observed a second time with a second credential.

**Net status**: the real, independent backend bug (item 4) is fixed and
proven via a direct HTTP round-trip. The WSO2 gateway credential itself
is, once again, not currently valid — so the full
`browser → WSO2 → backend → Supabase` round-trip for an authenticated
`/profile` request could not be proven end-to-end at the moment of
writing, purely because the credential expired mid-session. The fix in
item 5 does not depend on WSO2 being reachable to be correct — it was
verified with WSO2 removed from the request path entirely.

## 24. Full verification matrix — identity isolation proven, gateway credential still invalid, and a discrepancy worth flagging

Ran a complete matrix (two throwaway Supabase users, real tokens, real
HTTP requests, cleaned up immediately after — see the project's
established live-check methodology):

| Test | What | Result |
|---|---|---|
| A | Direct `/api/v1/profile`, User A's real token | `200`, User A's own profile — correct |
| A2 | Direct `/api/v1/profile`, User B's real token | `200`, User B's own profile, **zero leakage of A's data** |
| E | WSO2 `/health`, no user token | `401 Invalid Credentials` (gateway-level) |
| B | WSO2 `/profile`, User A's real token | `401 Invalid Credentials` — never reached the backend, rejected at the gateway |
| C | WSO2 `/profile`, garbage Supabase token | `401 Invalid Credentials` — confounded by D below, inconclusive on its own |
| D | WSO2 `/health`, deliberately-garbage WSO2 key | `401 Invalid Credentials` — **identical error to the "real" configured key** |

**Tests A/A2 are the important, durable result**: the identity/RLS fix
from §23 is proven correct, including cross-user isolation (User B's
token can never see User A's data) — this is independent of WSO2 and
does not degrade if the gateway credential expires again.

**Tests B/D together are the important gateway finding**: the
"real" `WSO2_API_KEY` currently in `.env.local` produces the exact same
`900901 Invalid Credentials` response as an intentionally-invalid
placeholder string. That is strong evidence the configured credential
is not currently being accepted by WSO2 at all right now — not a
header-forwarding problem, not a backend problem.

**A discrepancy worth flagging directly**: this contradicts a claim that
the WSO2 Developer Portal's own "Try it out" for `GET /health` currently
shows a live `200`. Both can be true at once if the Portal's "Try it
out" panel generates and uses its **own** short-lived test token at
click-time, separate from whatever string was copied into `.env.local`
— this is standard behavior for WSO2 API Manager/Bijira's "Get Test Key"
flow (see §21/§23: a `WSO2_API_KEY` value 1598 characters long is far
too long to be a simple opaque API key — that length is consistent with
a signed JWT access token, which is exactly what "Get Test Key" issues,
and exactly the kind of credential that carries a short expiry by
design). **Recommendation**: don't trust the Portal's own "Try it out"
result as proof that `.env.local`'s value works — copy the token
straight from the Portal into `.env.local` immediately before testing,
or (better, permanently) switch to an Application-based production
credential that doesn't expire on this short a cycle. I cannot access
the WSO2 Portal directly to generate or verify one myself.

## 25. Manual WSO2 Portal steps — best-effort, not verified against your live portal session

I do not have browser/portal access, so the following is standard
WSO2 API Manager / Bijira terminology from general product knowledge,
**not confirmed against your specific tenant's current UI** — the exact
labels can vary by WSO2 version/plan. Verify each step actually exists
before relying on it; if a step doesn't match what you see, that's more
reliable than this document.

1. **Open the Developer Portal** for the CareerLens API (the same portal
   where "Get Test Key" was used before).
2. **Applications** (usually a top-level nav item, sometimes under your
   account menu) → open or create an Application (e.g. "CareerLens
   Production") — this is distinct from a per-session test key; an
   Application persists and can be reused.
3. Inside the Application, find **Subscriptions** (or "APIs") and
   subscribe the CareerLens REST API (`careerlens-rest-api`, v1.0) to
   this Application, on a production-appropriate tier if tiers are
   offered.
4. Find **Production Keys** (sometimes under "Credentials" or "OAuth2
   Keys") for that Application and **generate** a production key/token —
   this is the credential meant to be long-lived/renewable, as opposed
   to "Get Test Key"'s short-TTL convenience token.
5. **THIS CANNOT BE CONFIRMED FROM HERE**: whether that generated
   credential is a static API key (paste once, use indefinitely) or an
   OAuth2 client-credentials pair (client id + secret, requiring this
   app to exchange them for a short-lived access token and refresh it
   server-side before each expiry) depends entirely on how this specific
   API was published in WSO2. If it's the latter, `lib/wso2/client.ts`
   would need a small, genuinely new piece: a server-side token
   cache+refresh function that runs before `callWso2` sends the request,
   never on every single call. I have not built this speculatively — it
   depends on what the portal actually offers, which I cannot see.
6. Copy the resulting credential into `.env.local`'s `WSO2_API_KEY`
   (and confirm `WSO2_API_KEY_HEADER` still matches whatever header name
   this credential type expects — that may differ from the test-key
   header).
7. **Test immediately** with the app's own diagnostic
   (`GET /api/wso2-status`, signed in) rather than the Portal's own "Try
   it out" — the Portal's own test may use a different token than the
   one now in `.env.local` (see §24). A successful result looks like
   `status: "AUTHENTICATED"` and `profile.ok: true` with your own real
   profile data.

## 26. FULLY VERIFIED — OAuth2 Client Credentials, live, end-to-end, proven

`.env.local` was updated with real OAuth2 Client Credentials
(`WSO2_TOKEN_URL`, `WSO2_CONSUMER_KEY`, `WSO2_CONSUMER_SECRET`), replacing
the short-lived "Get Test Key" flow that kept expiring (§21/§23/§24).

### Architecture

There are **two distinct identities**, never conflated:

```
CareerLens user (Supabase login)
        │
        │  Supabase access token (JWT)
        ▼
Next.js server ── lib/auth/require-user.ts#getAccessToken()
        │
        │  1. Application identity: WSO2_CONSUMER_KEY + WSO2_CONSUMER_SECRET
        │     → POST WSO2_TOKEN_URL (RFC 6749 Client Credentials grant)
        │     → lib/wso2/auth.ts#getWso2AccessToken() (cached, auto-refreshed)
        │     → Authorization: Bearer <WSO2 application access token>
        │
        │  2. User identity: the SAME Supabase JWT from step 0
        │     → X-Supabase-Token: <Supabase user JWT>
        ▼
WSO2 API Gateway (validates the application token)
        │
        │  forwards X-Supabase-Token through untouched
        ▼
CareerLens REST API (/api/v1/profile) ── lib/api/auth.ts#authenticateApiRequest
        │
        │  independently re-verifies the JWT against Supabase itself —
        │  WSO2's acceptance of the application is a SEPARATE, unrelated
        │  check from this
        ▼
auth.supabase (bearer-token-authenticated, RLS-scoped client)
        │
        ▼
Supabase → the correct, specific user's profile row
```

`Authorization` carries the WSO2 **application** token. `X-Supabase-Token`
carries the **user** token. They are never merged, never confused, and
`lib/api/auth.ts` was not changed to make this work — it already accepted
`X-Supabase-Token` as an equally-trusted, independently-reverified source
from the earlier header-forwarding investigation (§19-20).

### Live verification — every acceptance criterion, real network calls, no mocks

| Test | Result |
|---|---|
| OAuth2 token obtained from `WSO2_TOKEN_URL` | ✅ Real token, RFC 6749 Basic-auth client-credentials grant |
| `GET /health` through WSO2 with the OAuth2 token | ✅ `200 healthy` |
| Invalid WSO2 consumer secret | ✅ Rejected (`401 AUTH_ERROR`) before any API call is attempted |
| Direct `/api/v1/profile`, real user token, WSO2 bypassed | ✅ `200`, correct user's own profile |
| **`GET /profile` through WSO2, OAuth2 app token + real Supabase user token** | ✅ **`200`, the exact correct user's profile — the full chain, proven** |
| User B's token through WSO2 | ✅ `200`, User B's own profile, zero leakage of User A's data |
| WSO2 `/profile`, valid app token, **no** user token | ✅ `401 UPSTREAM_UNAUTHORIZED` (correctly rejected — app-only traffic isn't user traffic) |
| WSO2 `/profile`, valid app token, **invalid** user token | ✅ `401 UPSTREAM_UNAUTHORIZED` (correctly rejected — WSO2 accepted the app, backend independently rejected the bad user token) |

Every credential/user in this table was throwaway (created and deleted
via the admin client within the same test run) or an intentionally-broken
value substituted temporarily and restored immediately after. No secret
value was ever printed, logged, or written to this document.

### Credential lifecycle

`lib/wso2/auth.ts#getWso2AccessToken()` caches the token in-memory
(module-level, server-side only), refreshes automatically ~30 seconds
before the real `expires_in` elapses, and de-duplicates concurrent
callers into one in-flight token request rather than firing a token
request per API call. The legacy `WSO2_API_KEY` path (§4 onward) remains
fully intact and untouched — `callWso2` picks OAuth2 mode automatically
whenever all three OAuth2 variables are set, and only falls back to the
legacy header mode when they aren't, so nothing that worked before this
change can regress.

### Fallback behavior — reviewed, kept, still honestly labeled

`getCareerProfileViaWso2OrDirect()` still falls back to direct Supabase
on any WSO2 failure — this is a deliberate resilience choice, not a
security weakening: `transport: "wso2" | "direct" | "not_configured"` on
the return value means a caller can always tell which path actually
served the request, and nothing in the UI or logs claims "wso2" for a
request that silently fell back. Given WSO2 is now proven to work
end-to-end with real credentials, direct fallback should now be rare in
practice — but keeping it means a future credential expiry degrades to
"still works, without the gateway" rather than an outage.
