-- =====================================================================
-- CareerHQ — Core schema (profiles, jobs, resumes, certifications,
-- settings, job status history) + Row Level Security.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`)
-- BEFORE 0002_social_schema.sql and 0003_storage.sql.
-- Safe to re-run: every statement is idempotent.
-- =====================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type work_arrangement as enum ('remote', 'hybrid', 'onsite');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employment_type as enum ('full_time', 'part_time', 'contract', 'internship', 'temporary');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_status as enum (
    'saved', 'applying', 'applied', 'assessment', 'recruiter_contacted',
    'interview', 'final_interview', 'offer', 'rejected', 'ghosted', 'closed', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_verdict as enum ('apply', 'maybe', 'skip');
exception when duplicate_object then null; end $$;

do $$ begin
  create type certification_status as enum ('not_started', 'in_progress', 'completed', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type visibility_level as enum ('private', 'friends_only', 'selected_friends', 'hidden');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles — one row per auth user, private by default
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null default '',
  avatar_url text,
  career_goal text,
  primary_job_titles text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  weekly_application_goal integer not null default 5 check (weekly_application_goal >= 0),
  sharing_enabled boolean not null default false,
  status_message text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_.]{3,24}$')
);

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

alter table profiles enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on profiles;
create policy "profiles_delete_own" on profiles for delete
  using (auth.uid() = id);

-- Auto-create a profile row (with a placeholder username) whenever a new
-- auth user is created, so the app always has somewhere to write onboarding data.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 12),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.privacy_settings (user_id) values (new.id) on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- settings — per-user app preferences (theme, kanban column visibility)
-- ---------------------------------------------------------------------
create table if not exists settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'floral' check (theme in ('floral', 'neutral', 'dark')),
  -- New users see a focused 6-column board (saved/applying/applied/interview/offer/rejected)
  -- rather than all 12 statuses at once; the rest are one click away in the
  -- column-visibility menu, which overwrites this array explicitly.
  hidden_statuses job_status[] not null default '{assessment,recruiter_contacted,final_interview,ghosted,closed,archived}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_settings_updated_at on settings;
create trigger trg_settings_updated_at before update on settings
  for each row execute function set_updated_at();

alter table settings enable row level security;

drop policy if exists "settings_owner_all" on settings;
create policy "settings_owner_all" on settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- resumes
-- ---------------------------------------------------------------------
create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_role text,
  file_path text,
  file_name text,
  file_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_resumes_user on resumes(user_id);

drop trigger if exists trg_resumes_updated_at on resumes;
create trigger trg_resumes_updated_at before update on resumes
  for each row execute function set_updated_at();

alter table resumes enable row level security;

drop policy if exists "resumes_owner_all" on resumes;
create policy "resumes_owner_all" on resumes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  company text not null,
  company_logo_url text,
  title text not null,
  location text,
  salary text,
  work_arrangement work_arrangement,
  employment_type employment_type,
  source text,
  job_url text,
  job_description text,

  date_found timestamptz not null default now(),
  date_applied timestamptz,
  deadline date,

  status job_status not null default 'saved',
  verdict job_verdict,
  fit_score smallint check (fit_score is null or (fit_score between 0 and 10)),

  resume_id uuid references resumes(id) on delete set null,
  cover_letter_used text,
  priority smallint not null default 2 check (priority between 1 and 3),

  follow_up_date date,
  interview_date timestamptz,
  offer_date timestamptz,
  rejection_date timestamptz,

  recruiter_name text,
  recruiter_email text,
  recruiter_linkedin text,

  strengths text,
  missing_qualifications text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobs_user on jobs(user_id);
create index if not exists idx_jobs_user_status on jobs(user_id, status);
create index if not exists idx_jobs_user_date_applied on jobs(user_id, date_applied);
create index if not exists idx_jobs_resume on jobs(resume_id);

drop trigger if exists trg_jobs_updated_at on jobs;
create trigger trg_jobs_updated_at before update on jobs
  for each row execute function set_updated_at();

alter table jobs enable row level security;

drop policy if exists "jobs_owner_all" on jobs;
create policy "jobs_owner_all" on jobs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Stamp date_applied the first time a job moves to 'applied' — never
-- overwrite a manually entered date. Also stamp interview/offer/rejection
-- dates the first time status reaches those stages.
create or replace function jobs_stamp_status_dates()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'applied' and new.date_applied is null then
    new.date_applied = now();
  end if;
  if new.status in ('interview', 'final_interview') and new.interview_date is null then
    new.interview_date = now();
  end if;
  if new.status = 'offer' and new.offer_date is null then
    new.offer_date = now();
  end if;
  if new.status = 'rejected' and new.rejection_date is null then
    new.rejection_date = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jobs_stamp_dates on jobs;
create trigger trg_jobs_stamp_dates before insert or update of status on jobs
  for each row execute function jobs_stamp_status_dates();

-- ---------------------------------------------------------------------
-- job_status_history — audit trail shown in the Job Details "History" tab
-- ---------------------------------------------------------------------
create table if not exists job_status_history (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_status job_status,
  to_status job_status not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_status_history_job on job_status_history(job_id, changed_at desc);

alter table job_status_history enable row level security;

drop policy if exists "status_history_owner_select" on job_status_history;
create policy "status_history_owner_select" on job_status_history for select
  using (auth.uid() = user_id);

create or replace function jobs_log_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into job_status_history (job_id, user_id, from_status, to_status)
    values (new.id, new.user_id, case when tg_op = 'INSERT' then null else old.status end, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jobs_log_status on jobs;
create trigger trg_jobs_log_status after insert or update of status on jobs
  for each row execute function jobs_log_status_change();

-- ---------------------------------------------------------------------
-- certifications
-- ---------------------------------------------------------------------
create table if not exists certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  provider text,
  status certification_status not null default 'not_started',
  progress_percentage smallint not null default 0 check (progress_percentage between 0 and 100),
  start_date date,
  target_completion_date date,
  completion_date date,
  expiration_date date,
  certificate_file_path text,
  course_link text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_certifications_user on certifications(user_id);

drop trigger if exists trg_certifications_updated_at on certifications;
create trigger trg_certifications_updated_at before update on certifications
  for each row execute function set_updated_at();

alter table certifications enable row level security;

drop policy if exists "certifications_owner_all" on certifications;
create policy "certifications_owner_all" on certifications for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep certifications.status consistent with progress_percentage input.
create or replace function certifications_sync_status()
returns trigger
language plpgsql
as $$
begin
  if new.progress_percentage = 100 and new.completion_date is null then
    new.completion_date = current_date;
  end if;
  if new.progress_percentage = 100 then
    new.status = 'completed';
  elsif new.progress_percentage > 0 and new.status = 'not_started' then
    new.status = 'in_progress';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_certifications_sync_status on certifications;
create trigger trg_certifications_sync_status before insert or update of progress_percentage on certifications
  for each row execute function certifications_sync_status();
