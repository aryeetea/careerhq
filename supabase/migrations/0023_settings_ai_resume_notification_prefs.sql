-- Phase 3 (Settings): three real, backed additions — not placeholder
-- toggles. Each gates something that already exists in the product:
--   - default_resume_id     pre-fills the resume picker in AddJobDialog
--   - show_ai_fit_score     hides the fit-score badge on job cards
--   - muted_notification_types  filters which activity_events the
--                            notification bell surfaces
-- "Connected Accounts" (OAuth) is intentionally not built here — Bloom
-- has no OAuth provider configured, and enabling one is a Supabase
-- dashboard change, not something this migration can do.
alter table settings
  add column if not exists default_resume_id uuid references resumes(id) on delete set null,
  add column if not exists show_ai_fit_score boolean not null default true,
  add column if not exists muted_notification_types text[] not null default '{}';
