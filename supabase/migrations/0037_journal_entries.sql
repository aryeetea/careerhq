-- Bloom — Journal. A personal, reflective record of the job search — not
-- a feed, not a blog. An entry belongs to the person who wrote it; who
-- else (if anyone) can read it is a per-entry choice, not an app-wide
-- setting.
--
-- Photos and tags are deliberately not columns here yet — they're listed
-- as future in the product spec this shipped from, and an unused column
-- is worse than no column.
create type journal_mood as enum ('excited', 'hopeful', 'calm', 'proud', 'grateful', 'tired', 'anxious', 'discouraged');

create type journal_visibility as enum ('private', 'friends', 'group', 'public');

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text not null,
  mood journal_mood,
  visibility journal_visibility not null default 'private',
  -- Only meaningful (and only ever set) when visibility = 'group' — which
  -- one group gets to see this entry. Enforced below, not just in the app.
  group_id uuid references groups(id) on delete set null,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_group_requires_group check (visibility <> 'group' or group_id is not null)
);

create index if not exists idx_journal_entries_user on journal_entries(user_id, entry_date desc);

drop trigger if exists trg_journal_entries_updated_at on journal_entries;
create trigger trg_journal_entries_updated_at before update on journal_entries
  for each row execute function set_updated_at();

alter table journal_entries enable row level security;

-- Owner always sees their own entries regardless of visibility. Everyone
-- else's access is exactly what the entry's own visibility says — a
-- friends-only entry to a non-friend, or a group entry to someone outside
-- that group, simply doesn't return a row; there's no separate "hidden"
-- state to leak through.
drop policy if exists "journal_entries_select" on journal_entries;
create policy "journal_entries_select" on journal_entries for select
  using (
    auth.uid() = user_id
    or (visibility = 'friends' and is_friend(user_id, auth.uid()))
    or (visibility = 'group' and group_id is not null and is_group_member(group_id, auth.uid()))
    or (visibility = 'public' and auth.uid() is not null)
  );

drop policy if exists "journal_entries_insert" on journal_entries;
create policy "journal_entries_insert" on journal_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "journal_entries_update" on journal_entries;
create policy "journal_entries_update" on journal_entries for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "journal_entries_delete" on journal_entries;
create policy "journal_entries_delete" on journal_entries for delete
  using (auth.uid() = user_id);
