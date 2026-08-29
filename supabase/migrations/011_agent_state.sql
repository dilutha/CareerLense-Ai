-- CareerLens AI — Phase 21: conversational job refinement + stateful
-- career agent.
--
-- Depends on migration 010 (conversations). Purely additive: one new
-- column.
--
-- Decision (Part 3): extend `conversations` with a single `agent_state`
-- JSONB column, rather than a separate `conversation_state` table. The
-- state is genuinely 1:1 with its conversation (never a growing history —
-- each turn overwrites the whole object, it's never appended to), so a
-- second table would only add a join for no benefit — the same reasoning
-- already used for e.g. `applications.interview_at` (a single-value
-- addition to an existing owning row) rather than a new table, elsewhere
-- in this project. RLS is already correctly scoped on `conversations`
-- itself (migration 010's `profile_id = auth.uid()` policies) — no new
-- policy is needed, since this column is just more data on an
-- already-protected row.

alter table public.conversations
  add column agent_state jsonb not null default '{}'::jsonb;

comment on column public.conversations.agent_state is
  'Structured career/job-search conversation state (Phase 21) — target role, seniority, locations, work modes, exclusions, the last shown result job IDs, selected job, etc. Validated by lib/agent-state/schema.ts (CareerAgentStateSchema) at the application layer; never trusted as pre-validated at the database layer. Whole-object overwrite per turn, never appended to.';
