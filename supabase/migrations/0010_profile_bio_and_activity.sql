-- =====================================================================
-- Bloom — Profile bio + personal activity feed.
--
-- `bio` is the new stable "Professional bio" field (the existing
-- `status_message` column already behaves as the spec's "Daily
-- Reflection" — short, changes often — so it is relabeled in the UI only
-- and NOT touched here).
--
-- `profile_activity` powers the Profile page's "Recent Activity" feed.
-- Kept separate from `activity_events` (which backs the social
-- notification bell and is selected with no type filter + a Realtime
-- subscription) so personal "you did X" entries never leak into the
-- bell as generic "New activity" notifications. Mirrors the
-- `ai_request_logs` table's owner-only shape/RLS pattern.
--
-- Safe to re-run: idempotent.
-- =====================================================================

alter table profiles
  add column if not exists bio text;

create table if not exists profile_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profile_activity_user
  on profile_activity(user_id, created_at desc);

alter table profile_activity enable row level security;

drop policy if exists "profile_activity_owner_select" on profile_activity;
create policy "profile_activity_owner_select" on profile_activity for select
  using (auth.uid() = user_id);

drop policy if exists "profile_activity_owner_insert" on profile_activity;
create policy "profile_activity_owner_insert" on profile_activity for insert
  with check (auth.uid() = user_id);
