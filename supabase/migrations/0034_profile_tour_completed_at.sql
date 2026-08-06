-- Bloom — Persistent completion state for the guided product tour.
--
-- The tour must appear exactly once, right after a person finishes signup
-- and onboarding, and never again on its own afterward — not on the next
-- login, not on a new device, not after a refresh. localStorage (the old
-- WelcomeTutorialDialog's approach) can't do that: it's per-browser, so a
-- second device or a cleared cache would show it again. A profile column
-- is the only thing that's actually persistent per account.
--
-- Nullable timestamp, same shape as profiles.onboarded_at: null means "not
-- seen yet", a timestamp means "completed (or skipped) on this date" and
-- doubles as a record of when. Settings → Help → Replay Product Tour
-- re-runs the tour on demand without touching this column, so replaying
-- never re-flags the account as a first-time user.
alter table public.profiles
  add column if not exists tour_completed_at timestamptz;

-- No RLS changes needed: profiles_update_own (0001_core_schema.sql) already
-- lets a user update any column on their own row.
