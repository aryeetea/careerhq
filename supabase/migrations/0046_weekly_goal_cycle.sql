-- =====================================================================
-- Durable weekly-goal cycle marker
--
-- A browser-local counter made progress differ between devices and could
-- become incorrect as entries aged out of the rolling seven-day window.
-- This timestamp is account-owned and marks the start of the next cycle.
-- =====================================================================

alter table public.profiles
  add column if not exists weekly_goal_cycle_started_at timestamptz;

comment on column public.profiles.weekly_goal_cycle_started_at is
  'When the current repeatable weekly application-goal cycle began.';
