-- Bloom — v1.0 foundation: realtime publication, follow-up completion,
-- cover-letter metadata, and a safe "applying" status migration.

-- ---------------------------------------------------------------------
-- Realtime: the supabase_realtime publication was empty. Every
-- postgres_changes subscription in the app (including the notifications
-- one already written in services/notifications.ts) has been silently
-- inert since it shipped — Realtime only broadcasts changes for tables
-- explicitly added here. RLS is still enforced per-subscriber by
-- Postgres Realtime, so adding a table does not widen who can see what;
-- it only lets already-authorized rows reach an already-authorized
-- client without a manual refetch.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table journal_entries;
alter publication supabase_realtime add table activity_events;
alter publication supabase_realtime add table friend_requests;
alter publication supabase_realtime add table friendships;
alter publication supabase_realtime add table group_invites;
alter publication supabase_realtime add table group_members;
alter publication supabase_realtime add table goals;
alter publication supabase_realtime add table goal_members;

-- ---------------------------------------------------------------------
-- Follow-up completion — "mark follow-up complete" needs somewhere to
-- record that it happened, separate from just clearing follow_up_date
-- (which would look identical to "never had a follow-up"). follow_up_round
-- caps the automatic sequence at two, per spec, without an unbounded loop.
-- ---------------------------------------------------------------------
alter table jobs
  add column if not exists followed_up_at timestamptz,
  add column if not exists follow_up_round smallint not null default 0;

comment on column jobs.followed_up_at is 'When the current follow-up was marked complete. Null while a follow-up is still open or none is scheduled.';
comment on column jobs.follow_up_round is 'How many follow-ups have been completed for this application. Capped at 2 by the app before offering another.';

-- ---------------------------------------------------------------------
-- Cover letter metadata — "last updated" needs its own timestamp; jobs.
-- updated_at changes on every field edit, not just the cover letter.
-- ---------------------------------------------------------------------
alter table jobs
  add column if not exists ai_cover_letter_updated_at timestamptz;

-- Backfill: for jobs that already have a cover letter, use the job's own
-- updated_at as a reasonable estimate rather than leaving it null.
update jobs set ai_cover_letter_updated_at = updated_at
where ai_cover_letter is not null and ai_cover_letter_updated_at is null;

-- ---------------------------------------------------------------------
-- Status model: "Applying" is being retired as a selectable status —
-- Saved and Applied cover the same ground without an ambiguous middle
-- state nobody could explain the difference for. The enum value itself
-- stays (dropping a Postgres enum value is a destructive, effectively
-- irreversible schema change, and isn't necessary just to stop offering
-- it going forward) — only existing rows move, and only forward, per the
-- rule this shipped with: evidence of submission means Applied, otherwise
-- Saved. No rows are deleted.
-- ---------------------------------------------------------------------
update jobs set status = 'applied' where status = 'applying' and date_applied is not null;
update jobs set status = 'saved' where status = 'applying';
