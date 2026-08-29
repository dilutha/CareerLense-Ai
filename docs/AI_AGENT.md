# AI Agent

Status: Gemini is integrated (Phase 4), receives authenticated career
profile context (Phase 5), parses/evaluates uploaded resumes (Phase 6),
searches + matches real job listings from multiple sources (Phase 7, real
sources as of Phase 9 — ITPro.lk is genuinely live), tailors CVs + cover
letters for a selected job (Phase 8), analyzes portfolio/GitHub/LinkedIn
content plus runs a job-specific interview coach (Phase 10), narrates a
deterministically-built learning roadmap plus reasons about real
application-tracking data (Phase 11), extracts reminder intent from chat
so it can set real follow-up/interview reminders through a deterministic
action (Phase 12), and — as of Phase 21 — maintains a structured,
persisted conversation state so job-search refinement ("international
company ekak nam hodai") and result references ("second eka") work
without the user repeating themselves. The WSO2 integration phase added
one more, narrow Gemini call — structured career analysis via the
versioned `/api/v1/ai/career-analysis` endpoint (`lib/api/career-analysis.ts`)
— reachable outside the conversational chat product entirely, for API
consumers behind WSO2; see [`WSO2_API.md`](WSO2_API.md). No Gemini function-calling — see
"Why no real tool-calling loop" below for why, and what's used
instead.

## Layer (`lib/ai/`)

- `client.ts` — lazy, server-only `GoogleGenAI` singleton. Never imported
  from a Client Component (guarded by `server-only`).
- `config.ts` — model name (`GEMINI_MODEL`, defaults to `gemini-3.6-flash`),
  temperature, and message/history limits. The only place a model name is
  hard-coded.
- `prompts.ts` — `CAREERLENS_SYSTEM_PROMPT`: personality, language
  behavior (English/Sinhala/Singlish), what the assistant can and cannot
  do yet, truthfulness rules, and prompt-injection handling for pasted
  content (job descriptions, resume text).
- `career-agent.ts` — `streamCareerAgentReply(messages, { signal, careerContext, resumeContext, jobContext })`:
  builds the Gemini request (system instruction = base prompt + optional
  career/resume/job context blocks, appended, not interleaved into the
  conversation turns) and yields plain-text chunks. The only file that
  imports `@google/genai` for conversational chat (resume and job analysis
  each have their own separate Gemini calls — see below).
- `intent.ts` — lightweight keyword-based `detectCareerIntent()`, logged
  server-side only. Does not alter what's sent to Gemini — separate from
  `lib/jobs/intent.ts`'s job-search-specific intent extraction (below).
- `chat-client.ts` — browser-facing boundary. `streamChatReply()` calls
  `POST /api/chat` and yields parsed NDJSON events (text chunks, job
  results, or errors — see "The NDJSON protocol" below). Chat components
  never import Gemini types or call the agent directly.
- `mock.ts` — local mock reply generator from Phase 3. Unused in the live
  path; kept for isolated UI development/testing only.
- `tools/index.ts` — empty registry, reserved for future tools.

## Request flow

```text
Browser (ChatWindow)
   │  streamChatReply()
   ▼
POST /api/chat
   │  1. validate request shape/roles/length
   │  2. verify session via createServerSupabaseClient().auth.getClaims()
   │     (401 if missing — /chat is a protected route, so this should
   │     always be authenticated in normal usage)
   │  3. fetch career profile + resume context (parallel)
   │  4. if the message looks job-search-related, extract intent and
   │     search+match (see "Job discovery" below) — cheap keyword gate
   │     first, so this doesn't run on every message
   ▼
streamCareerAgentReply(messages, { careerContext, resumeContext, jobContext })
   │
   ▼
Gemini (generateContentStream) — streamed
   │
   ▼
NDJSON events → browser: a "jobs" event first (if any results), then
"text" chunks appended to a growing assistant message
```

## The NDJSON protocol

`/api/chat`'s response body is one JSON object per line
(`Content-Type: application/x-ndjson`), not plain text — see
`lib/ai/types.ts#ChatStreamEvent`:

```text
{"type":"conversation","conversationId":"..."} — at most once, always first, only when a real conversation now backs this turn
{"type":"status","toolStatus":"searching_jobs"} — at most once, before any jobs/text, only when real work (a job search, selected-job lookup) is actually happening this turn
{"type":"jobs","jobs":[...]}     — optional, at most once
{"type":"text","content":"..."}  — one or more, appended in order
{"type":"error","message":"..."} — only if the stream is interrupted mid-turn
```

`chat-client.ts` buffers incoming bytes and splits on `\n` (a line isn't
guaranteed to arrive in one `read()` call), yielding parsed events.
`ChatWindow.tsx` renders `"jobs"` events as an inline `JobResultsMessage`
(real `JobCard`s, the same component used on `/jobs`), shows a `"status"`
event as a transient `ToolStatus` chip (removed the moment real content
arrives — never a fake progress percentage, just a label like "Looking
for relevant jobs..."), and appends `"text"` events to the current
assistant message. This is a deliberately minimal, incrementally-extended
protocol (four small additions since Phase 4's original plain-text
stream), not a move to SSE.

### Chat persistence (`lib/chat/`)

Every turn is persisted server-side, inside this same route handler, not
via a separate client-triggered save: a conversation row is created
lazily on the first real message (`lib/chat/persist.ts#getOrCreateConversation`
— clicking "New Chat" never creates an empty, abandoned row on its own),
the user's message is saved before Gemini is even called (so it's never
lost if the Gemini call fails), and the assistant's reply — even a
partial one, if the stream is interrupted — is saved once the turn
finishes. `/chat` starts a fresh conversation; `/chat/[id]` loads and
continues a persisted one, 404s identically whether it doesn't exist or
belongs to someone else. See `docs/DATABASE.md` for the `conversations`/
`messages` schema and RLS.

## Career profile context

`lib/career-profile/get-profile.ts` fetches the authenticated user's
profile (id always from the verified session, never client input).
`lib/career-profile/profile-context.ts` compresses it into a short
`CAREER PROFILE:` text block — only fields the user actually filled in,
truncated to a safe length — appended to the system instruction. If the
profile is empty, the context explicitly says so, so the model asks
instead of guessing. Gemini never receives raw database rows.

## Resume parsing + analysis (`lib/resume/`)

A separate Gemini pipeline from conversational chat — one non-streaming
call per uploaded resume, triggered by the `processResume` Server Action
(`lib/resume/actions.ts`), not by chat.

- `prompts.ts` — `RESUME_INTELLIGENCE_SYSTEM_PROMPT`: its own rules,
  distinct from the chat persona — treat resume text as untrusted data
  (prompt-injection defense), never fabricate extracted facts, and be
  undergraduate-aware (projects/internships/coursework count as evidence,
  not having a job doesn't automatically mean a weak resume).
- `schemas.ts` — Zod schemas for both the extracted facts
  (`ResumeParsedDataSchema`: contact, skills, education, experience,
  projects, certifications, languages, detected/missing sections) and the
  evaluative output (`ResumeFindingSchema`: a category, a ±impact, a label,
  and an explanation). `GeminiResumeOutputSchema` combines both — one
  schema, one Gemini call, to keep free-tier usage low.
- `parse-resume.ts` — calls `generateContent` (not streamed) with
  `responseMimeType: "application/json"` and `responseJsonSchema` generated
  directly from `GeminiResumeOutputSchema` via `z.toJSONSchema()` — one
  schema is the single source of truth for both what Gemini is asked to
  return and what's validated afterward. Retries once on a validation
  failure before giving up; never saves unvalidated output.
- `analyze-resume.ts` — **the numeric score is never trusted directly from
  Gemini.** `computeResumeScore()` derives it deterministically: each of
  six categories (content, skills, experience, projects, clarity,
  completeness) starts at a base of 75 and is nudged by the sum of that
  category's finding impacts, clamped to [0, 100]; the overall score is
  their average. This is what "scoring must be explainable" means in
  practice — every point is traceable to a specific finding.
- `extract-text.ts` — `unpdf` for PDF, `mammoth` for DOCX, both
  server-only. Normalizes whitespace, caps extracted text at ~20k
  characters (recorded via `text_truncated`), and throws
  `ScannedDocumentError` if a PDF yields too little text to be useful
  (image-only scan) — surfaced as a friendly message, never silently
  analyzed as blank.
- `get-resume-context.ts` — compresses the user's default/most-recent
  ready resume's analysis into a short `RESUME CONTEXT:` block (score,
  detected skills, summarized strengths/weaknesses) for the chat system
  instruction. **Never the full extracted CV text** — that would bloat
  every chat request for no benefit.
- `actions.ts` — Server Actions: `uploadResume` (validate, upload to
  Storage, insert `resumes` row) and `processResume` (download, extract,
  call Gemini, insert `resume_versions` + `resume_analysis`, update
  status) are separate so a failed analysis can be retried without
  re-uploading the file, and so the UI can show distinct
  "Uploaded" → "Reading..." → "Ready" states.

The career profile is never auto-updated from resume findings (e.g. a
skill detected in the CV but missing from the profile) — that always
requires explicit user action, not implemented yet.

## Job discovery + matching (`lib/jobs/`)

Three separate Gemini calls, none of them the conversational chat model:

- `analyze-job.ts` — one-time, per-job structured extraction (skills with
  required/preferred/nice_to_have, education requirements, experience
  level, keywords) — gated by whether `job_skills` rows already exist for
  that job, so the same listing is never re-analyzed. Uses the same
  `responseJsonSchema`-from-Zod pattern as resume parsing.
- `intent.ts` — `extractJobSearchIntent()`, gated by a cheap keyword regex
  (`looksLikeJobSearchMessage()`) so most chat messages never trigger an
  extra Gemini call at all. Only extracts what the user actually said or
  what's already in their known profile — never invents a role/location.
  Sets `shouldSearch: false` for anything that isn't really a search
  request (small talk, "what skills should I learn").
- `actions.ts#explainJobMatch` — a short, non-streamed, friendly narration
  of an *already-computed* match (from `job_matches`), used by the "Why
  does this match?" button on a job card. Never recomputes the score.

**The match score itself is never asked of Gemini.** See `DATABASE.md`'s
Phase 7 section for the deterministic scoring formula
(`lib/jobs/match.ts`) — Gemini's role is limited to the analysis and
narration calls above.

### Multi-source discovery (Phase 9, expanded Phase 10A)

`discoverJobs()` (`lib/jobs/discovery.ts`) queries every active provider
concurrently (`Promise.all` over independently try/caught calls — one
provider failing never fails the search), normalizes + validates +
deduplicates the results, then runs the same `analyze-job.ts` extraction
per NEW/unanalyzed job only. See `JOB_DATA.md` for the full provider
architecture (ITPro.lk live, SerpApi Google Jobs implemented but not
live-tested — no `SERPAPI_API_KEY` configured, company-careers mechanism,
LinkedIn/XpressJobs/ikman manual-only except when surfaced through
SerpApi) and `lib/jobs/rank.ts` for deterministic ranking (match score +
a small bounded freshness nudge — never enough to flip a large score
gap). Gemini never sees a provider's raw response — every result is
normalized and Zod-validated first (`lib/jobs/providers/serpapi.ts`'s
`SerpApiResponseSchema`/`SerpApiJobResultSchema`), consistent with "don't
trust external JSON blindly."

Chat's conversational results go through one more deterministic step,
`selectChatResults` — at most 5, only jobs clearing a 60% quality floor,
never padded with weak matches to hit a round number (PROJECT_SPEC's own
"if only 3 genuinely strong jobs exist, show 3"). If literally nothing
comes back, the model is told so explicitly in its context and instructed
to say so honestly rather than invent listings — see
`buildJobResultsContext`'s empty-result branch in `app/api/chat/route.ts`.

Each job in `JOB SEARCH RESULTS` now carries its real database `[id:...]`
inline (`lib/jobs/summary.ts#buildJobResultsContext`), so the model can
answer "why does the second one match?" grounded in the *specific* job's
own data rather than reconstructing it from its own prior prose — a
meaningful accuracy improvement over Phase 7's positional-only context,
though it's still scoped to jobs currently in context, not a general
lookup-any-job-by-description capability (see the tool-calling discussion
below).

### Why no real Gemini function-calling loop

The SDK supports it, but Phase 7 deliberately doesn't wire a streaming
tool-call loop (model → functionCall → server executes → functionResponse
→ model continues) into the conversational path. Instead: a cheap
deterministic keyword gate decides *whether* to search, a small
non-streaming Gemini call extracts *what* to search for, the search +
matching runs entirely deterministically, and the results are handed to
the conversational model as plain context (like `careerContext`/
`resumeContext`) before it starts streaming. This is simpler to reason
about and debug than a bidirectional multi-turn tool protocol, matches
`PROJECT_SPEC.md` §117's "Gemini should not rank raw jobs, use
deterministic filtering first" and §118's cost-control guidance directly,
and produces the same user-facing behavior (chat naturally, get job cards
inline, ask follow-ups). A real function-calling loop remains a viable
future refinement if the agent needs to *decide* between many different
tools dynamically — for one tool (jobs) triggered by one clear condition,
it isn't necessary yet.

One consequence: if a user asks about a previously-shown job in plain
prose ("what about the second one?") rather than clicking that job's
card, the model can only reason from what it already said in its own
prior text — it can't re-look-up the real job by ID from free text alone.
The "Why does this match?" button (which passes a real `jobId`) is the
robust path for that. **As of Phase 21, the prose fallback is largely
solved for conversational references specifically** ("second eka gana
kiyanna") via the agent-state pipeline below, which resolves an ordinal
position against real stored job IDs rather than the model's own memory —
see "Conversational job refinement + agent state" next.

## Conversational job refinement + agent state (`lib/agent-state/`) — Phase 21

Before this phase, every chat message was handled independently: a cheap
keyword gate decided whether *this one message* looked like a job search,
and a one-shot Gemini call (`lib/jobs/intent.ts#extractJobSearchIntent`)
extracted role/location/level/workMode from *only* that message, with no
memory of anything said in earlier turns. This broke down exactly where a
real conversation needs to work: a follow-up refinement like
"international company ekak nam hodai" contains no job-search keyword at
all, so the keyword gate would never even fire, and the search would
silently never refine.

Phase 21 replaces that one-shot path (for the live chat route; the older
`lib/jobs/intent.ts` module is untouched and still independently tested,
just no longer called from `app/api/chat/route.ts`) with a real,
persisted state, following PROJECT_SPEC's own pipeline:

```text
user message
   -> extract state UPDATE (Gemini, structured JSON, retried once)
   -> merge onto persisted state (deterministic)
   -> resolve any "first/second/third" reference against the real,
      stored result IDs (deterministic)
   -> if the update actually changes something search-relevant, build a
      JobSearchQuery from state and run it through the EXISTING
      discovery+matching pipeline, unchanged
   -> apply deterministic conversational filters + "show more" dedup
   -> rank (existing lib/jobs/rank.ts, unchanged) -> top 4-5
```

### State shape and where it lives

`lib/agent-state/schema.ts#CareerAgentState` — intent, targetRole,
seniority, locations, workModes, industries, companyPreferences,
companyTypes, technologies, skills, keywords, salaryExpectation,
internationalPreference, four `excluded*` arrays (Part 17's negative
preferences), selectedJobId, lastResultJobIds (the real IDs of the last
batch actually shown — the only thing an ordinal reference is ever
resolved against), lastSearchAt. Persisted as a single JSONB column,
`conversations.agent_state` (migration 011) — see `docs/DATABASE.md` for
why a column rather than a new table.

### Extraction — Gemini's actual job here

`lib/agent-state/extract-update.ts#extractStateUpdate` — one small,
structured-output Gemini call per relevant turn (gated by
`shouldExtractStateUpdate`, which is deliberately broader than the old
keyword gate: it also fires whenever the conversation is *already*
`intent: "job_search"`, since a refinement message often has no
job-search keyword in it at all). Retried once on a schema-invalid
response, matching this project's established pattern
(`lib/resume/parse-resume.ts`).

Gemini is given the CURRENT state and returns ONLY the fields the latest
message actually changes — never a full restatement. Critically, for
array fields (locations, workModes, etc.), **Gemini decides add-vs-replace
semantics, not the merge code** — e.g. "actually hybrid is okay" (current
workModes=["remote"]) should ADD, returning `["remote","hybrid"]"`, while
"anywhere in Sri Lanka" (current locations=["Colombo"]) should REPLACE,
returning `[]`. This can't be inferred mechanically from the two example
sentences alone — it genuinely requires understanding the sentence, which
is Gemini's job; `lib/agent-state/merge.ts#mergeAgentState` then does the
mechanical part (apply whatever value is present, leave absent keys
untouched) — a whole-field replace, not a deep merge, and deliberately
so (see that file's own comment for the full reasoning, including why
`.partial()`-with-defaults was a real bug caught during Phase 21's own
testing: Zod's `.partial()` does not stop an inner `.default()` from
firing on an absent key, which would have made "field absent = untouched"
silently false for every field).

Gemini also extracts two transient, turn-only signals that are NEVER
persisted as given: `referencedResultIndex` (a 1-indexed "second eka" ->
2) and `wantsMoreResults` ("show more"/"thawa jobs"). Per PROJECT_SPEC's
explicit instruction, **Gemini never states or remembers an actual job
ID** — `lib/agent-state/resolve-reference.ts` deterministically resolves
an index against `lastResultJobIds` instead, so a hallucinated or
misremembered ID is structurally impossible.

### What stays deterministic (never Gemini)

- The match score itself — completely unchanged, still
  `lib/jobs/match.ts`'s weighted formula. Gemini's role remains limited to
  extraction and narration, exactly as in every earlier phase.
- `lib/agent-state/build-search-criteria.ts` — converts state into the
  EXISTING `JobSearchQuery` shape, reusing `lib/jobs/actions.ts#searchJobsForCurrentUser`
  and the whole discovery/matching pipeline as-is (Part 8's explicit "do
  not create a second job-search implementation"). `companyTypes`/
  `internationalPreference`/`industries`/`technologies` have no
  structured field to filter on in the job data (no source populates a
  "company type" or "industry" column — see `docs/JOB_DATA.md`), so
  pretending to filter on them precisely would fabricate a signal the
  data doesn't have; instead they're folded into `keywords`, letting the
  EXISTING deterministic keyword-score component reward a real match
  honestly.
- `lib/agent-state/apply-filters.ts` — hard-excludes (excludedRoles/
  Companies/WorkModes) check only real fields the job data actually has
  (title, company_name, work_mode); `excludedIndustries` degrades to the
  same title-keyword check as excludedRoles for the same "no structured
  field" reason, documented in that file rather than silently assumed
  precise. Also handles "show more" deduplication against
  `lastResultJobIds`.

### Selected-job grounding

Once `selectedJobId` is set (by explicit reference resolution, or simply
persisting from an earlier turn), a job-detail question ("am I
qualified?", "salary eka mention karala thiyenawada?", "how do I apply?")
gets a `SELECTED JOB` context block (`lib/agent-state/build-context.ts`)
built from that job's real, live-refetched data (never duplicated inside
`agent_state` itself, which only stores the ID — `lib/agent-state/get-jobs-by-ids.ts`
re-fetches fresh every time, consistent with this project's "compute
live" pattern elsewhere) — title, real salary text or an honest "not
listed," the real application URL, and the user's own real matched/
missing skills. The model is told explicitly never to invent a salary
figure the source didn't provide.

### Why not LangChain/LangGraph

The entire pipeline above is: one structured Gemini call, a handful of
pure TypeScript functions, and a JSONB column — no agent framework, no
graph/node orchestration, no vector database. PROJECT_SPEC's own framing
is exactly right: the intelligence here comes from the architecture and
data flow (extract -> merge -> resolve -> search -> filter -> rank), not
from a framework. A LangGraph-style state machine would add a real
dependency and a new mental model for no capability this project doesn't
already have with five small, individually-testable, individually-
readable files.

## Job application tailoring (`lib/application/`)

Two more Gemini calls, both single-shot (non-streamed), gated behind the
`/application/[jobId]` page — never triggered inline mid-chat:

- `tailor-resume.ts` — rewrites the candidate's CV for one specific job.
  Structured output (same `responseJsonSchema`-from-Zod pattern as resume
  parsing), validated with Zod, retried once on failure.
- `generate-cover-letter.ts` — plain-text cover letter, no JSON schema.

**Truthfulness is enforced at the input, not by asking Gemini nicely.**
`verified-facts.ts` builds a closed `VerifiedFacts` object from only the
user's own career profile + selected resume version — no other source.
Both prompts (`lib/application/prompts.ts`) explicitly forbid introducing
any skill, employer, project, metric, or credential not present in that
object; if a job requires something the candidate's data doesn't show
(e.g. Tableau when only Power BI is listed), the prompt requires it be
flagged as missing/not verified, never claimed. The skill/keyword
*comparison* that drives the Application Optimization Dashboard
(`lib/application/compare.ts`) is entirely deterministic — no Gemini call
at all — reusing `lib/jobs/skill-aliases.ts` for exact/alias matching and
a small curated `related-skills.ts` list for "partial" matches, the same
"deterministic score, Gemini only narrates/generates" split as job
matching and resume scoring elsewhere in this file.

### Chat awareness, not chat generation

The chat system prompt (`lib/ai/prompts.ts`) knows the tailoring/cover-
letter feature exists and redirects a request like "machan me job ekata
cv eka hadamu" to the job's "Tailor My Application" button — it does not
generate a tailored CV or cover letter inline in the NDJSON chat stream.
This follows the same reasoning as job search's "no function-calling
loop" above: the flow needs a specific job *and* a specific saved CV
selected first, and the output is versioned on its own dashboard, so
routing to the dedicated page is simpler and safer than trying to carry
that state through free-form conversation.

## Career intelligence (`lib/portfolio/`, `lib/github/`, `lib/linkedin/`, `lib/interview/`) — Phase 10

Four more domains, each following the exact "Gemini produces findings,
application code computes the score" pattern from resume analysis
(Phase 6) — see `DATABASE.md`'s Phase 10 section for the category weights.
None of these run automatically; each is a deliberate user action
(analyze this portfolio URL, this GitHub username, this pasted LinkedIn
content, start this interview) — a real Gemini call, cached by content
hash so re-analyzing unchanged content never re-runs Gemini.

- `lib/portfolio/extract.ts` — pure, regex-based HTML parsing (title,
  meta description, heading structure, canonical/robots/OG/structured-data
  presence, image alt coverage, visible text) — no Gemini, no new DOM
  dependency. `analyze-portfolio.ts` then reads that structured extraction
  (not raw HTML) and produces findings.
- `lib/github/github-api.ts` — GitHub's official public REST API only
  (`api.github.com/users/{u}`, `.../repos`), unauthenticated by default
  (60 req/hr, verified live; an optional `GITHUB_TOKEN` raises this if
  ever set, never required). Never requests private-repo scopes, never
  asks for a password. `normalizeGitHubResponse` is a pure function
  (unit-tested against real-shaped and malformed responses) separated from
  the fetch, same pattern as `lib/jobs/providers/itpro.ts`.
- `lib/linkedin/analyze-linkedin.ts` — analyzes ONLY text the user pastes
  directly. No fetch, no URL, no scraping path exists in this module at
  all — LinkedIn's ToS prohibits automated access (same conclusion as
  `JOB_DATA.md`'s LinkedIn section) and this sidesteps that entirely by
  construction.
- `lib/interview/generate-questions.ts` / `evaluate-answer.ts` — question
  text and answer feedback are both grounded in VerifiedFacts
  (`lib/application/verified-facts.ts`, reused as-is from Phase 8, not
  reimplemented) — a `project` question must name an actual project from
  VerifiedFacts, a `job_specific` question must be grounded in the
  selected job's actual stated requirements. `evaluate-answer.ts`'s
  "Answer Quality Score" is framed as exactly that — never as an interview
  outcome or hiring-probability prediction (see `DATABASE.md`).

### Career readiness context

`lib/career/chat-context.ts#buildCareerReadinessContext` adds one more
compact block to the chat system instruction (alongside careerContext/
resumeContext/jobContext) — a live, deterministic snapshot of which
domains have been analyzed and their scores. Not fetched from raw
portfolio HTML or full GitHub repo content — those already have their own
compact contexts elsewhere; this one is specifically the cross-domain
readiness summary (`PROJECT_SPEC.md`'s "context size" instruction).

### Chat routes to dashboards, doesn't perform analysis inline

Same reasoning as Phase 8's CV tailoring: the chat system prompt
recognizes a portfolio/GitHub/LinkedIn/interview request and routes the
user to `/portfolio`, `/github`, `/linkedin`, or `/interview` rather than
running the analysis or a full mock interview inline in the NDJSON
stream. These flows need structured input (a URL, a username, pasted
text, a selected job) and produce output worth revisiting later
(versioned findings, a multi-question interview session) — exactly the
same shape of problem Phase 8 already solved by using a dedicated page
instead of extending the chat protocol.

## Application tracking, skill gaps, and learning roadmaps (`lib/applications/`, `lib/career/`, `lib/learning/`) — Phase 11

One more Gemini call in this whole phase, and it's the narrowest one yet:

- `lib/learning/generate-roadmap.ts#narrateRoadmap` — the ONLY Gemini call
  in Phase 11. Takes an already-fully-decided step list (order, skill,
  resource type, resource URL — all built by
  `lib/learning/build-plan.ts`, entirely deterministic, driven by real
  market-demand skill-gap priority from `lib/career/market-skills.ts` +
  `lib/career/skill-gap-priority.ts`) and asks Gemini only to write a 3-5
  sentence summary explaining *why* this order makes sense for this
  target role. `lib/learning/prompts.ts#ROADMAP_NARRATION_SYSTEM_PROMPT`
  is explicit that the step list/order/URLs are already decided and
  Gemini must never suggest a different one. Falls back to a plain
  templated sentence if the Gemini call fails, so a roadmap can always be
  produced.
- Every resource URL on a roadmap step comes from
  `lib/learning/resource-catalog.ts` — a small, hand-curated map of
  skill → real URL, each individually verified live (HTTP status
  checked) rather than trusted from a search or Gemini's own knowledge.
  A skill with no catalog entry gets an honest "search for X" note
  instead of a fabricated link — Gemini is architecturally incapable of
  supplying a URL here, by construction, not by prompt instruction alone.
- Application statistics (`lib/applications/stats.ts`), source/resume
  performance (`source-performance.ts`, `resume-performance.ts`), and
  analytics summary (`lib/applications/analytics-summary.ts`) involve
  **no Gemini call at all** — plain SQL/TypeScript counting and
  division, same "deterministic math, Gemini only narrates" split as
  every other domain in this file. `resume-performance.ts`'s
  observation string is generated in application code, not by Gemini,
  specifically so its "observed association, not causation" phrasing is
  guaranteed rather than hoped-for.

### Chat awareness of applications and learning

`lib/career/chat-context.ts` / `lib/applications/chat-context.ts` add an
`APPLICATIONS CONTEXT` block (real totals, interview rate, offer rate,
response rate — computed the same way `/applications` and `/analytics`
compute them, never re-estimated for chat) to the system instruction
built in `app/api/chat/route.ts`, alongside the existing career/resume/job/
readiness blocks. `lib/ai/prompts.ts`'s "Application tracking, skill gaps,
and learning roadmaps" section tells the model how to route: acknowledge
and use real numbers when asked "how are my applications going?", route to
`/career/skills` and `/career/roadmap` for skill-gap/learning questions
rather than generating a roadmap inline in chat, and for "why am I not
getting interviews?" specifically — reason only from the real
`APPLICATIONS CONTEXT` numbers if present, and say plainly "I don't have
enough application history yet" rather than guess when there isn't enough
data. Same reasoning as Phase 8/10's dashboard-routing pattern: these
flows produce output worth revisiting later (a tracked pipeline, a
versioned roadmap), so a dedicated page is simpler and safer than trying
to carry that state through free-form conversation.

## Notifications & reminders (`lib/notifications/`) — Phase 12

One more narrow Gemini call, following the exact same "cheap keyword gate
→ small extraction call → deterministic action" shape as job search
(`lib/jobs/intent.ts`) and reused verbatim in `app/api/chat/route.ts`'s
`maybeCreateReminder`:

- `lib/notifications/intent.ts#extractReminderIntent` — gated by
  `looksLikeReminderMessage()` (a cheap keyword/Sinhala-script regex), one
  small non-streamed Gemini call extracts `{wantsReminder, reminderType,
  applicationHint, normalizedDateText, clarifyingQuestion}`. Critically,
  `normalizedDateText` is a TRANSLATION/NORMALIZATION task, not a
  timestamp — Gemini turns "ලබන සඳුදා" or "next monday machan" into the
  plain-English phrase "next Monday"; it never outputs a date or time
  value itself (Part 12/16's "Never let the LLM invent the actual
  scheduled timestamp," enforced structurally, not just by prompt
  wording).
- `lib/notifications/parse-datetime.ts#parseReminderDateTime` — the ONLY
  thing that turns text into a real `Date`. Fully deterministic (no
  Gemini), anchored to Asia/Colombo wall-clock time
  (`lib/notifications/colombo-time.ts`, a hardcoded UTC+5:30 offset — Sri
  Lanka has no daylight saving). Returns `{ok:false}` rather than
  guessing for anything it can't confidently parse, or for a result
  that's already in the past.
- `lib/notifications/match-application.ts#matchApplicationByHint` —
  case-insensitive substring match against the user's own tracked
  applications' company name/job title. Returns a match only when
  EXACTLY ONE application matches; zero or multiple matches return
  `null` so the chat route asks the user to clarify instead of guessing
  which job they meant.
- **No notification content is ever written by Gemini.** All reminder/
  status-change text comes from fixed templates
  (`lib/notifications/templates.ts`) — Part 5's "Do NOT use Gemini for
  simple scheduling logic" applies to the message text too, not just the
  timestamp.

### The chat mutation path

`maybeCreateReminder` in `app/api/chat/route.ts` runs alongside
`maybeSearchJobs` on every message from a signed-in user. When intent,
application match, and date all resolve unambiguously, it calls
`lib/applications/actions.ts#setFollowUpDate` or `#setInterviewAt`
directly — the same Server Actions the `/applications/[id]` UI uses,
never a separate write path — then hands the conversational model a
short factual note (e.g. "a reminder was just created for X") appended
to its system instruction, so it can acknowledge what actually happened
in its own voice. When anything is missing or ambiguous (no application
match, no date, an unparseable date, a past date), the note instead tells
the model exactly what to ask — Gemini never guesses a date, an
application, or fabricates having created a reminder that wasn't
actually created.

### Delivery architecture — no background worker in this deployment

Per Part 14/15's explicit constraints (no Redis/BullMQ/Kafka/RabbitMQ,
no email/push unless genuinely needed), Phase 12 implements only the
notification data model and in-app delivery: a scheduled reminder
(`notifications.scheduled_for`) becomes visible the next time the signed-
in user loads a page that reads notifications, via
`lib/notifications/get-notifications.ts` marking any due-but-unsent row
as sent at that moment. There is no cron, no queue, and no email/push —
`sent_at` is never treated as proof of anything beyond "this was shown
in-app." A genuine production extension for closer-to-real-time delivery
(e.g. a scheduled job hitting the same due-marking query, or a real
email/push integration) is a deployment-time addition this phase
deliberately does not build — see `docs/DATABASE.md`'s Phase 12 section.

## The versioned REST API (`/api/v1`, `lib/api/`) — WSO2 integration

A stable, non-streaming REST surface, distinct from the conversational
`/api/chat` — meant to sit behind WSO2 API Manager as an externally-
consumable API (OAuth2, rate limiting, versioning, analytics all handled
by WSO2, in front of this backend). Full architecture, endpoint
catalogue, and authentication model: [`docs/WSO2_API.md`](WSO2_API.md).

The one new Gemini call this phase introduces is narrow and self-
contained: `POST /api/v1/ai/career-analysis`
(`lib/api/career-analysis.ts#runCareerAnalysis`) — takes a stated career
goal + skill list (explicitly given in the request, treated as true, the
same "user-provided evidence" trust level as anything a user types in
chat), optionally enriched with the caller's real profile context, and
returns `{strengths, skillGaps, recommendations}` via the same
structured-JSON-output + Zod validation + retry-once pattern used
everywhere else in this file (`lib/resume/parse-resume.ts`,
`lib/agent-state/extract-update.ts`). It never invents a qualification
the request/profile didn't actually contain.

Every OTHER `/api/v1` write endpoint reuses existing Gemini call sites
exactly as-is (resume analysis, CV tailoring, cover letter generation,
interview question generation/answer evaluation) — see `WSO2_API.md`'s
"reuse vs. new code" section for the `*Core(userId, supabase, ...)`
extraction pattern that made this possible without duplicating any
prompt/schema/VerifiedFacts logic.

## What's deliberately NOT here yet

- No Gemini function-calling loop in the conversational path — see above.
- The model can't crawl a portfolio URL, and the system prompt tells it to
  say so honestly rather than fabricate results.
- No conversation persistence — chat history lives in React state only.
- No LangChain/CrewAI/agent framework — Next.js + the Google GenAI SDK +
  these files, on purpose (see `PROJECT_SPEC.md` §44, §186).
- No email/push notifications, and no background worker/cron/queue
  (Phase 12 deliberately implements in-app-only delivery — see this
  file's Phase 12 section above).
