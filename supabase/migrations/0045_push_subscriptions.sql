-- =====================================================================
-- push_subscriptions — one row per browser/device the user has enabled
-- push notifications on (via PushManager.subscribe() in the service
-- worker, see src/lib/push.ts and PUSH NOTIFICATIONS in src/sw.ts).
--
-- Each row is the raw subscription object the Push API hands back:
-- endpoint (the browser vendor's push service URL for this specific
-- registration) plus the two keys needed to encrypt a message to it
-- (p256dh, auth) per the Web Push protocol (RFC 8291) — sendPushToUser in
-- supabase/functions/_shared/utils.ts uses all three to actually deliver
-- a notification via npm:web-push.
--
-- A user can have several rows at once (phone + laptop + a second
-- browser) — push fans out to all of them, same as any other
-- multi-device push setup. A row is user-owned data (RLS below), written
-- directly by the client with its own session, not through an edge
-- function — there's no server-side decision to make about "should this
-- device be subscribed," only the user's own action.
--
-- Safe to re-run.
-- =====================================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Globally unique per browser+device registration — the push service
  -- URL itself, not something Bloom generates. Re-subscribing the same
  -- device (e.g. after clearing site data) naturally produces a new
  -- endpoint, so upserting on this never silently merges two real
  -- devices into one row.
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,

  -- Best-effort label so a future "manage devices" UI in Settings could
  -- show something more useful than a bare endpoint URL — never parsed
  -- or relied on for behavior.
  user_agent text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

drop trigger if exists trg_push_subscriptions_updated_at on push_subscriptions;
create trigger trg_push_subscriptions_updated_at before update on push_subscriptions
  for each row execute function set_updated_at();

alter table push_subscriptions enable row level security;

-- Owner-only, all operations — the client subscribes/unsubscribes itself
-- directly (see src/lib/push.ts); sendPushToUser (utils.ts) reads across
-- users via the service-role admin client, which bypasses RLS entirely,
-- so this policy only ever needs to cover the owning user's own access.
drop policy if exists "push_subscriptions_owner_all" on push_subscriptions;
create policy "push_subscriptions_owner_all" on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
