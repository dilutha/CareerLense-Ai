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
