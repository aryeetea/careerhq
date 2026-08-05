-- =====================================================================
-- CareerHQ — AI job analysis, resume text extraction, and rate limiting.
--
-- Adds cached extracted resume text plus persisted AI analysis fields on
-- jobs so the frontend can stay thin and all OpenAI work can happen in
-- authenticated Edge Functions.
--
-- Safe to re-run: column additions are guarded and table creation is
-- idempotent.
-- =====================================================================

alter table resumes
  add column if not exists extracted_text text,
  add column if not exists extracted_text_updated_at timestamptz,
  add column if not exists is_active boolean not null default true;

alter table jobs
  add column if not exists ai_extracted_data jsonb,
  add column if not exists ai_analysis jsonb,
  add column if not exists ai_recommended_resume_id uuid references resumes(id) on delete set null,
  add column if not exists ai_cover_letter text,
  add column if not exists ai_last_analyzed_at timestamptz;

update jobs
set ai_extracted_data = '{}'::jsonb
where ai_extracted_data is null;

alter table jobs
  alter column ai_extracted_data set default '{}'::jsonb;

create table if not exists ai_request_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_request_logs_user_action_created
  on ai_request_logs(user_id, action, created_at desc);

alter table ai_request_logs enable row level security;

drop policy if exists "ai_request_logs_owner_select" on ai_request_logs;
create policy "ai_request_logs_owner_select" on ai_request_logs for select
  using (auth.uid() = user_id);
