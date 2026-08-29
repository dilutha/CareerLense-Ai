-- CareerLens AI — Phase 12: notifications & reminders.
--
-- Depends on migrations 001 (profiles), 003 (jobs), 008 (applications,
-- application_status_history). Purely additive: one new column on
-- applications, one new table.
--
-- `applications.interview_at` is a new nullable column — Phase 11's
-- `applications` table has follow_up_date (a plain date, "when to check
-- back") but nothing for a real scheduled interview date/time. This is
-- NOT the same concept as interview_sessions (Phase 10, a mock/practice
-- interview run) — it's the actual real-world interview appointment for
-- a tracked application, entered by the user or via chat.
--
-- `notifications` is a single table for all reminder/alert types (follow
-- ups, interview reminders, deadlines, status changes) rather than one
-- table per type — they share the same shape (a scheduled/created
-- message tied to an application) and splitting them would just
-- duplicate columns for no benefit; `type` distinguishes them.
--
-- Idempotency (Part 13) is enforced at the database layer, not just in
-- application code:
--   - status_change notifications are 1:1 with the application_status_history
--     row that caused them (related_status_history_id, UNIQUE) — retrying
--     the same status update can only ever produce one notification per
--     history row, because the history insert itself is what's retried,
--     and a second history row for an identical transition is a distinct
--     real event, not a duplicate.
--   - follow_up/interview/deadline reminders are scheduled at a
--     DETERMINISTIC offset from their source date (see
--     lib/notifications/compute-reminders.ts) — the same source date
--     always produces the same scheduled_for, so
--     UNIQUE (profile_id, related_application_id, type, scheduled_for)
--     makes re-running the reconciliation logic (lib/notifications/sync.ts)
--     safe to call repeatedly (page refresh, retried Server Action, a
--     future cron) without ever creating a second identical row.

alter table public.applications
  add column interview_at timestamptz;

comment on column public.applications.interview_at is
  'The real scheduled interview date/time for this application (Phase 12) — distinct from interview_sessions (Phase 10 mock/practice interviews). Nullable; only set once the user or chat provides a real date.';

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null
    check (type in (
      'application_follow_up', 'interview_reminder', 'application_deadline',
      'status_change', 'action_required'
    )),
  title text not null,
  message text not null,
  related_application_id uuid references public.applications (id) on delete cascade,
  related_job_id uuid references public.jobs (id) on delete set null,
  -- Set only for type = 'status_change' — see idempotency note above.
  related_status_history_id uuid references public.application_status_history (id) on delete cascade,
  scheduled_for timestamptz not null default now(),
  read_at timestamptz,
  -- Set the first time this notification is actually surfaced to the
  -- user (status_change notifications are stamped immediately at
  -- creation — there's nothing to wait for; scheduled reminders are
  -- stamped by lib/notifications/get-notifications.ts the first time a
  -- due row is served, since there is no background worker/cron in this
  -- deployment — see docs/AI_AGENT.md for the full delivery-architecture
  -- explanation). NEVER treated as proof of an email/push being sent —
  -- this project has neither.
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_status_history_unique unique (related_status_history_id),
  constraint notifications_scheduled_unique unique (profile_id, related_application_id, type, scheduled_for)
);

create index notifications_profile_id_idx on public.notifications (profile_id);
create index notifications_scheduled_for_idx on public.notifications (scheduled_for);
create index notifications_unread_idx on public.notifications (profile_id, read_at) where read_at is null;

comment on table public.notifications is
  'In-app notifications/reminders (Phase 12) — follow-up, interview, and deadline reminders plus status-change alerts. sent_at is only ever set when actually surfaced in-app; there is no email/push delivery in this deployment.';

-- ---------------------------------------------------------------------------
-- Row Level Security — standard profile_id = auth.uid() ownership,
-- consistent with every other user-owned table in this project. Full CRUD
-- (not append-only) because notifications are legitimately mutated by
-- their owner: mark read, and the reconciliation logic in
-- lib/notifications/sync.ts deletes/recreates STILL-UNSENT scheduled
-- reminders when their source date changes — never a sent/already-seen
-- notification, which application code treats as immutable by convention
-- even though RLS technically permits it (matching how this project
-- already trusts server-side application logic within RLS's boundary,
-- e.g. resume_versions' insert-only convention is enforced by the actions
-- layer, not by a stricter policy, elsewhere in this codebase).
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (profile_id = auth.uid());
create policy "notifications_insert_own" on public.notifications
  for insert with check (profile_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "notifications_delete_own" on public.notifications
  for delete using (profile_id = auth.uid());
