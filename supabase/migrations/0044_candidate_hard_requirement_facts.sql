-- =====================================================================
-- candidate_hard_requirement_facts — durable, user-confirmed answers to
-- hard-requirement questions raised by job analysis (see
-- jobExtraction.dealBreakers in the AI response).
--
-- The "Hard requirements to confirm" card previously just displayed a
-- Needs confirmation/Possible badge with nowhere for the user's actual
-- answer to go — the same requirement gets re-flagged on every posting,
-- and re-running analysis for one job doesn't carry the answer to any
-- other job. This table gives that answer a permanent home on the
-- candidate's profile: keyed by a stable requirement_key (see
-- dealBreakerSchema.requirementKey), not by the AI's per-posting wording,
-- so "yes, I have construction experience" answered once is reusable
-- everywhere that requirement comes up again — and editable later if the
-- candidate's situation changes (a new cert earned, a skill let lapse).
--
-- Safe to re-run.
-- =====================================================================

do $$ begin
  create type candidate_fact_answer as enum ('yes', 'no', 'partial');
exception when duplicate_object then null; end $$;

create table if not exists candidate_hard_requirement_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Stable, AI-assigned slug for the requirement's general category (e.g.
  -- "construction_industry_experience"), not the exact posting wording —
  -- see requirementKey in careerCoach.ts HARD REQUIREMENTS. This is what
  -- lets one confirmed answer match the same requirement across different
  -- postings phrased differently.
  requirement_key text not null,
  -- The most recent human-readable requirement text this was confirmed
  -- against, kept for display in Settings — not used for matching.
  label text not null,
  answer candidate_fact_answer not null,
  -- Optional free-text elaboration, e.g. "3 years as a site supervisor at
  -- ABC Construction" — shown back to the user and passed to the AI as
  -- supporting context, never required.
  detail text,
  -- Always 'user_confirmed' today; reserved so a future source (e.g.
  -- inferred from a résumé) doesn't have to be a schema change.
  source text not null default 'user_confirmed',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint candidate_hard_requirement_facts_user_key unique (user_id, requirement_key)
);

create index if not exists idx_candidate_hard_requirement_facts_user on candidate_hard_requirement_facts(user_id);

drop trigger if exists trg_candidate_hard_requirement_facts_updated_at on candidate_hard_requirement_facts;
create trigger trg_candidate_hard_requirement_facts_updated_at before update on candidate_hard_requirement_facts
  for each row execute function set_updated_at();

alter table candidate_hard_requirement_facts enable row level security;

drop policy if exists "candidate_hard_requirement_facts_owner_all" on candidate_hard_requirement_facts;
create policy "candidate_hard_requirement_facts_owner_all" on candidate_hard_requirement_facts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
