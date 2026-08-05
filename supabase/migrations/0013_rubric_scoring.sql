-- =====================================================================
-- CareerHQ — Rubric-based scoring.
--
-- 1. Change fit_score from smallint to numeric(4,1) so the application
--    can store the weighted average calculated from per-category scores
--    (e.g. 7.5 instead of only 7 or 8).
-- 2. Add ai_rubric_version to track which rubric produced each analysis,
--    parallel to the existing ai_prompt_version column.
-- =====================================================================

-- Drop the auto-generated inline check constraint before altering the type.
-- We locate it by inspecting pg_constraint rather than hard-coding the
-- Postgres-generated name (which varies across installations).
do $$
declare
  _con text;
begin
  select conname into _con
  from pg_constraint
  where conrelid = 'jobs'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%fit_score%';
  if _con is not null then
    execute format('alter table jobs drop constraint %I', _con);
  end if;
end;
$$;

alter table jobs
  alter column fit_score type numeric(4,1)
  using fit_score::numeric(4,1);

alter table jobs
  add constraint jobs_fit_score_range
  check (fit_score is null or (fit_score >= 0 and fit_score <= 10));

alter table jobs add column if not exists ai_rubric_version text;
