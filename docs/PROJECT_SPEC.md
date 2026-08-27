# CareerLens AI

## Implementation Status

- ✅ Phase 1 — Project foundation (Next.js, TypeScript, Tailwind, design system)
- ✅ Phase 2 — Interactive landing page
- ✅ Phase 3 — Production-style chat UI (mock responses)
- ✅ Phase 4 — Gemini integration, streaming, CareerLens personality
- ✅ Phase 5 — Supabase Authentication (email/password), PostgreSQL schema
  with Row Level Security, career profile (onboarding + dashboard), and
  authenticated career-profile context feeding the AI.
- ✅ Phase 6 — CV upload (PDF/DOCX) to private Supabase Storage, server-side
  text extraction, combined Gemini parsing + evaluation with an
  explainable deterministic score, resume review UI, and resume context
  feeding the chat AI alongside the career profile.
- ✅ Phase 7 — Sri Lanka-first job discovery via a source-agnostic provider
  architecture (demo/fixture provider active by default — no real search
  API credential configured yet), deterministic weighted job matching
  (skills/role/experience/education/location/keywords, alias-aware skill
  matching, never-zero experience scoring for entry-level candidates),
  `/jobs` search + detail + saved pages, and chat-integrated job search
  (results shown as real interactive cards inline in conversation, not
  just described in prose).
- ✅ Phase 8 — Job-specific CV tailoring, ATS/keyword alignment analysis,
  and tailored cover letter generation. Deterministic (non-Gemini) resume-
  vs-job comparison (`lib/application/compare.ts`) categorizes each
  required skill as a strong match, match, partial (via a small curated
  related-skill map, e.g. Power BI for a Tableau requirement), missing, or
  insufficient evidence, and scores keyword alignment the same way. A
  closed-world `VerifiedFacts` object (`lib/application/verified-facts.ts`),
  built only from the user's own career profile + selected resume, is the
  sole source Gemini may draw from when tailoring a CV or writing a cover
  letter — the prompt explicitly forbids introducing anything outside it.
  Both the tailored CV and the cover letter are versioned (append-only,
  original resume never modified), with a version history UI and a
  browser-print/PDF-friendly layout (`/application/[jobId]`). **None of
  the four migrations (001, 002, 003, 004) have been applied to the live
  Supabase project yet** — see [`DATABASE.md`](DATABASE.md). Not yet
  implemented: a real live job source, interview agent, application
  tracking, portfolio crawling.

See [`ARCHITECTURE.md`](ARCHITECTURE.md), [`DATABASE.md`](DATABASE.md),
[`AI_AGENT.md`](AI_AGENT.md), and [`JOB_DATA.md`](JOB_DATA.md) for details.

The sections below are the original product specification and describe the
full intended product — not everything in them is built yet.

## 1. Project Overview

CareerLens AI is a friendly AI-powered career assistant designed primarily for Sri Lankan undergraduates, fresh graduates, and entry-level job seekers.

The system helps users discover relevant internships and jobs, understand their suitability for a vacancy, improve their CV and portfolio, create/refine cover letters, and prepare for interviews.

The main interaction model is conversational rather than form-heavy.

Users can communicate naturally using:

* English
* Sinhala
* Singlish
* Mixed Sinhala/English
* Informal conversational language

Example:

> "machan mata data analyst internship ekak oni Colombo wala"

The AI should understand the intent and continue the conversation naturally.

---

## 2. Product Personality

CareerLens should feel like a knowledgeable, supportive Sri Lankan career friend.

The conversational AI should be:

* Friendly
* Informal
* Helpful
* Encouraging
* Honest
* Non-judgmental
* Conversational
* Context-aware

The AI may naturally use casual expressions such as:

* "Ado"
* "machan"
* "hari"
* "ela"
* "patta"
* "balamu"
* "dapan"
* "set wenawa"

However, it must not overuse slang or emojis.

The AI should adapt to the user's language style.

If the user speaks formal English, respond professionally.

If the user speaks Singlish, respond naturally in Singlish.

If the user speaks Sinhala, respond naturally in Sinhala.

If the user requests professional output, generated CVs, cover letters, LinkedIn content, and application materials must use professional language even if the conversation itself is informal.

---

## 3. Core Principle

CareerLens is not simply a resume generator or job search website.

Its main purpose is:

> Understand the candidate → understand available opportunities → determine suitability → explain the match → identify gaps → improve the application → prepare the candidate for the interview.

The system must prioritize truthful representation.

The AI must never invent:

* Qualifications
* Skills
* Work experience
* Certifications
* Projects
* Achievements
* Job experience
* Metrics
* Employer names
* Academic results

If information is missing, the AI should ask the user or clearly indicate that evidence is unavailable.

---

## 4. Target Users

### Primary

* Sri Lankan university undergraduates
* Internship seekers
* Final-year students
* Fresh graduates

### Secondary

* Entry-level job seekers
* Early-career professionals
* Career switchers

Initial focus should be:

* Data Science
* Data Analytics
* Software Engineering
* IT
* Cybersecurity
* Business Analysis
* Business Information Systems

The architecture should remain extensible to other careers.

---

## 5. Main User Journey

### First Visit

Landing page → Interactive introduction → Start Chatting

### Chat

The AI asks naturally what the user needs.

The user may say:

> "mata internship ekak oni"

The AI gathers only the necessary information conversationally.

It should not force users through a long registration form.

The AI should request:

* CV upload, if available
* Portfolio URL, if available
* GitHub/LinkedIn information, if relevant
* Target role
* Location preference
* Internship/full-time preference
* Remote/hybrid preference

---

## 6. CV Processing

Users can upload a CV.

The system should extract structured information including:

* Name
* Education
* University
* Degree
* Skills
* Technologies
* Experience
* Projects
* Certifications
* Achievements
* Languages
* Portfolio
* GitHub
* LinkedIn

The extracted information should become the candidate profile.

The system should preserve the original CV.

---

## 7. Portfolio Analysis

Users can provide a portfolio URL.

CareerLens should analyze available public portfolio information including:

* About section
* Skills
* Projects
* Project descriptions
* Experience
* Contact information
* Portfolio structure
* Basic SEO factors
* Recruiter readability
* Job relevance

The system should provide actionable recommendations.

Example:

> Your Power BI skill is listed, but there is no project demonstrating it. Consider adding a Power BI project if you have actually completed one.

---

## 8. Job Discovery

CareerLens should focus on Sri Lankan opportunities.

Potential sources include:

* Sri Lankan job portals
* Company career pages
* University career pages
* Other permitted public sources

LinkedIn should be supported primarily through search/navigation and user-provided job information unless official API access is available.

The system must not implement unauthorized LinkedIn scraping.

CareerLens should store normalized job information using a common schema.

---

## 9. Job Object

Each job should support:

* ID
* Job title
* Company
* Location
* Employment type
* Description
* Responsibilities
* Required skills
* Preferred skills
* Education requirements
* Experience requirements
* Salary if publicly available
* Posted date
* Closing date
* Source
* Original URL

---

## 10. Job Matching

The system should combine deterministic matching and AI/semantic analysis.

Initial dimensions:

* Skill match
* Semantic similarity
* Project relevance
* Experience
* Education
* Evidence strength

Initial conceptual weighting:

* Skill Match: 35%
* Semantic Similarity: 20%
* Project Relevance: 15%
* Experience: 10%
* Education: 10%
* Evidence: 10%

These weights should remain configurable.

The final system should later support experimentation with different weighting strategies.

---

## 11. Match Explanation

CareerLens should not only provide a percentage.

Example:

> Match: 88%

Then show:

### Strong Matches

* Python
* SQL
* Power BI
* Data Visualization

### Partial Matches

* Excel

### Gaps

* Tableau

### Evidence

Explain where skills are demonstrated in the candidate's CV/projects/portfolio.

---

## 12. Resume Evaluation

When the user selects a job, CareerLens should compare the resume against the job description.

Analyze:

* Required keyword coverage
* Skill alignment
* Project relevance
* Experience relevance
* Evidence
* Clarity
* ATS-friendly structure
* Missing information
* Weak evidence

The system should identify keywords but must not encourage keyword stuffing.

---

## 13. Resume Refinement

The system can suggest or generate improved resume content based on the selected vacancy.

Rules:

* Never fabricate experience.
* Never invent metrics.
* Never claim skills the candidate does not have.
* Preserve truthful candidate information.
* Prefer measurable evidence when the user has supplied it.
* Ask the user for missing facts where appropriate.

---

## 14. Cover Letter

CareerLens should create a job-specific cover letter based on:

* Candidate profile
* Selected job
* Company
* Job requirements
* Candidate's genuine experience

The cover letter should not be generic.

---

## 15. Interview Agent

The user can request:

> "machan interview ekata practice karamu"

CareerLens enters interview mode.

It should generate questions based on the selected job.

Question categories:

* Introduction
* Behavioral
* Technical
* Scenario-based
* Project-related
* Job-specific

The agent should evaluate user responses and provide constructive feedback.

---

## 16. Language Behavior

The conversation layer supports:

English:

> "I found three strong matches for your profile."

Singlish:

> "Ado, jobs tika hoyagatta. Me first eka nam oyata hodata match."

Sinhala:

> "ඔබගේ skills වලට ගැලපෙන internship අවස්ථා කිහිපයක් හම්බුණා."

Mixed:

> "Me job eka oyage Python + SQL skills walata hondatama match."

The system should naturally mirror the user's preferred communication style.

---

## 17. Landing Page

The landing page should be visually premium but friendly.

Theme:

* Sea breeze
* Ocean
* Blue
* Sky
* Deep navy
* White
* Soft gradients

Technology:

* Next.js
* Three.js / React Three Fiber
* Framer Motion

The landing page should contain:

1. Hero
2. Interactive AI introduction
3. Example conversation
4. CareerLens capabilities
5. Career journey
6. Final CTA

Primary CTA:

> Start Chatting

The landing page should introduce the AI interactively rather than functioning like a traditional corporate landing page.

---

## 18. UI Principle

The chatbot is the main interface.

Avoid excessive forms.

The user should feel like they are talking to a career buddy.

The dashboard can provide supporting functionality:

* Chat
* Jobs
* My CV
* Portfolio
* Matches
* Applications
* Interview

---

## 19. Technology Stack

Frontend:

* Next.js
* TypeScript
* React
* Tailwind CSS
* Framer Motion
* Three.js
* React Three Fiber

Backend:

* Next.js API routes / server-side functions
* Supabase (PostgreSQL, Auth, Storage)

AI:

* Gemini API

Database:

* Supabase PostgreSQL, accessed directly via the Supabase client (no Prisma)

Future semantic search:

* pgvector (via Supabase)

Deployment:

* Vercel

---

## 20. Architecture Principle

Do not send every task directly to the LLM.

Use deterministic application logic for:

* Database operations
* Filtering
* Ranking
* Calculations
* Validation
* Duplicate detection
* Match scoring
* Evaluation

Use Gemini for:

* Natural language understanding
* Conversational interaction
* Structured information extraction
* Job description interpretation
* Explanations
* Recommendations
* Resume refinement
* Cover letters
* Interview conversation

---

## 21. Initial AI Tools

The Career Agent should eventually have access to tools such as:

* searchJobs
* getJob
* extractCandidateProfile
* analyzeResume
* analyzePortfolio
* analyzeJob
* calculateMatch
* identifySkillGaps
* evaluateResume
* improveResume
* generateCoverLetter
* prepareInterview

The agent should use tools rather than attempting to perform all operations through one giant prompt.

---

## 22. Security

Never expose API keys to the client.

Sensitive operations must run server-side.

Validate uploaded files.

Restrict file types.

Limit file sizes.

Sanitize external URLs.

Never execute arbitrary user-provided code.

Do not expose internal prompts or API credentials.

---

## 23. MVP

MVP must include:

1. Landing page
2. Chat interface
3. Gemini integration
4. Sinhala/Singlish/English conversation
5. CV upload
6. CV extraction
7. Candidate profile
8. Job database
9. Sri Lankan job search
10. Job matching
11. Match explanation
12. Skill-gap analysis
13. Resume evaluation
14. Resume refinement
15. Cover letter generation
16. Interview preparation
17. External application links

Do not build automatic job application submission in the MVP.

---

## 24. Development Philosophy

Build incrementally.

Do not generate the entire application at once.

Each feature must be:

* Implemented
* Tested
* Reviewed
* Refactored where necessary

Before moving to the next major feature.

Keep components modular.

Keep business logic separate from UI.

Keep AI logic separate from database logic.

Keep job-source adapters separate from the rest of the application.

Do not introduce unnecessary technologies.

Do not over-engineer the MVP.

---

## 25. Research Component

The project should support later experimentation comparing:

1. Keyword matching
2. TF-IDF similarity
3. Embedding similarity
4. Hybrid matching

Potential evaluation metrics:

* Precision@K
* Recall@K
* F1
* NDCG@K
* Human relevance ratings

The matching engine should therefore be designed so that different algorithms can be tested independently.

---

## 26. Important Rule for Claude Code

Do not implement the complete project in one step.

First inspect the specification.

Explain the proposed implementation plan.

Then implement only the requested phase.

After implementation:

* Run lint
* Run type checking
* Run tests
* Verify the application
* Report files changed
* Report remaining issues

Never silently make major architectural changes.

Never replace working functionality without justification.

Always preserve the project's core architecture and requirements.
