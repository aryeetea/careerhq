-- =====================================================================
-- Bloom — Fix: deleting a user fails via the weekly_progress resync.
--
-- Deleting a row from auth.users cascades into jobs (jobs.user_id
-- references auth.users(id) on delete cascade). That cascade delete
-- fires trg_jobs_sync_weekly_progress (AFTER DELETE), which calls
-- sync_weekly_progress(old.user_id) to keep the weekly aggregate in
-- sync — but sync_weekly_progress upserts into weekly_progress, whose
-- user_id also references auth.users(id). By the point the cascade
-- reaches jobs, the parent auth.users row has already been removed
-- from this transaction's view, so that upsert fails:
--
--   insert or update on table "weekly_progress" violates foreign key
--   constraint "weekly_progress_user_id_fkey"
--
-- In practice this means a user can never delete their own account —
-- any self-service or admin deleteUser call rolls back with this
-- error the moment they have a single job saved.
--
-- Fix: jobs_sync_weekly_progress() skips the resync on the DELETE path
-- when the owning user no longer exists (i.e. this delete is itself
-- part of a user-deletion cascade, not a normal job removal). Normal
-- job deletes by an existing user are unaffected — the resync still
-- runs so weekly_progress stays accurate.
--
-- Safe to re-run: `create or replace function` is idempotent.
-- =====================================================================

create or replace function jobs_sync_weekly_progress()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    -- Cascading from a deleted user — the FK on weekly_progress.user_id
    -- would fail here anyway, and there's no user left to show a
    -- weekly aggregate to. Skip the resync.
    if not exists (select 1 from auth.users where id = old.user_id) then
      return old;
    end if;
    perform sync_weekly_progress(old.user_id);
    return old;
  end if;
  perform sync_weekly_progress(new.user_id);
  return new;
end;
$$;
