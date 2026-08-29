-- CareerLens AI — UX Refactor: chat persistence + sidebar management
-- (PART 19/20).
--
-- Depends on migration 001 (profiles). Purely additive: two new tables.
-- Chat history has never been persisted before this — Phase 3-4 shipped
-- conversational chat, but `docs/AI_AGENT.md` has documented "no
-- conversation persistence — chat history lives in React state only" ever
-- since. This migration is what actually backs it.
--
-- Two tables, not one wide `messages` table with an embedded array —
-- `conversations` is the sidebar-visible unit (title, ordering by recency);
-- `messages` is its own table so RLS/ownership/cascade-delete all follow
-- the same one-row-per-fact pattern already used everywhere else in this
-- project (e.g. application_status_history), rather than growing an
-- unbounded JSONB array on a single row.
--
-- Guest (anonymous-auth) users use these exact same tables, isolated by
-- the same RLS as everyone else — there is no separate "guest chat"
-- schema. Guest chat history is "temporary" (Part 20) by virtue of the
-- guest's own identity being temporary/discardable, not by a different
-- storage mechanism: deleting an unconverted anonymous auth.users row
-- cascades through profiles -> conversations -> messages automatically.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'New chat',
  -- True once the user has explicitly renamed it — protects a custom
  -- title from ever being silently overwritten by auto-titling logic.
  title_is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index conversations_profile_id_idx on public.conversations (profile_id);
create index conversations_last_message_at_idx on public.conversations (profile_id, last_message_at desc);

create trigger conversations_set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

comment on table public.conversations is
  'One row per chat conversation shown in the sidebar. Deleting a conversation cascades to its messages.';

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  -- The same JobResultSummary[] shape already shown inline in the chat UI
  -- (lib/jobs/summary.ts) — stored so reloading a conversation shows the
  -- same job cards, not just the surrounding text.
  job_results jsonb,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_idx on public.messages (conversation_id, created_at);
create index messages_profile_id_idx on public.messages (profile_id);

comment on table public.messages is
  'Append-only — a conversation''s turns. No update/delete policy for the client at all; deleting the parent conversation is the only way to remove messages.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "conversations_select_own" on public.conversations
  for select using (profile_id = auth.uid());
create policy "conversations_insert_own" on public.conversations
  for insert with check (profile_id = auth.uid());
create policy "conversations_update_own" on public.conversations
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "conversations_delete_own" on public.conversations
  for delete using (profile_id = auth.uid());

-- Append-only: select + insert only, no update/delete policy at all for
-- the client — a message is never edited or individually removed, only
-- ever added; the whole conversation is deleted (cascade) instead.
create policy "messages_select_own" on public.messages
  for select using (profile_id = auth.uid());
create policy "messages_insert_own" on public.messages
  for insert with check (profile_id = auth.uid());
