-- =====================================================================
-- Bloom — AI-generated daily encouragement. Two short messages per user
-- per calendar day (Dashboard gets a punchy one-liner, Profile gets a
-- warmer, slightly longer one) written by generate-daily-encouragement
-- from that day's real activity (streak, this week's applications vs.
-- goal, recent status changes) — not a static rotating quote list.
--
-- Cached one row per (user_id, message_date) so opening the app twice in
-- one day, or having both Dashboard and Profile open, never triggers a
-- second AI call — the edge function checks this table first and only
-- calls OpenAI on a cache miss. Mirrors ai_request_logs' owner-only
-- shape/RLS: only the edge function's service-role client ever writes a
-- row, so there are no insert/update/delete policies for regular users.
-- =====================================================================

create table if not exists daily_encouragements (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_date date not null,
  dashboard_message text not null,
  profile_message text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, message_date)
);

create index if not exists idx_daily_encouragements_user_date
  on daily_encouragements(user_id, message_date desc);

alter table daily_encouragements enable row level security;

drop policy if exists "daily_encouragements_owner_select" on daily_encouragements;
create policy "daily_encouragements_owner_select" on daily_encouragements for select
  using (auth.uid() = user_id);
