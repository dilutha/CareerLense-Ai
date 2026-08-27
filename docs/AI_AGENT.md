# AI Agent

Status: Gemini is integrated (Phase 4), receives authenticated career
profile context (Phase 5), parses/evaluates uploaded resumes (Phase 6),
and now searches + matches real (currently: demo) job listings (Phase 7).
No Gemini function-calling — see "Why no real tool-calling loop" below for
why, and what's used instead.

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
{"type":"jobs","jobs":[...]}     — optional, at most once, always first
{"type":"text","content":"..."}  — one or more, appended in order
{"type":"error","message":"..."} — only if the stream is interrupted mid-turn
```

`chat-client.ts` buffers incoming bytes and splits on `\n` (a line isn't
guaranteed to arrive in one `read()` call), yielding parsed events.
`ChatWindow.tsx` renders `"jobs"` events as an inline `JobResultsMessage`
(real `JobCard`s, the same component used on `/jobs`) and appends
`"text"` events to the current assistant message. This is a deliberately
minimal extension of Phase 4's plain-text stream, not a move to SSE.

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
robust path for that; the prose fallback is a known, accepted limitation.

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

## What's deliberately NOT here yet

- No Gemini function-calling loop in the conversational path — see above.
- The model can't crawl a portfolio URL, and the system prompt tells it to
  say so honestly rather than fabricate results.
- No conversation persistence — chat history lives in React state only.
- No LangChain/CrewAI/agent framework — Next.js + the Google GenAI SDK +
  these files, on purpose (see `PROJECT_SPEC.md` §44, §186).
