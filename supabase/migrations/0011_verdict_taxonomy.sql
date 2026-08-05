-- =====================================================================
-- Bloom — Verdict taxonomy overhaul: replace the 3-value job_verdict enum
-- (apply/maybe/skip) with 6 meaningful categories so verdict means the
-- same thing everywhere (AI analysis, manual override dropdown, Board
-- filters).
--
-- `jobs` has 0 rows at the time this was written (re-verified via
-- list_tables immediately before running) — this is a clean type swap,
-- not a data migration. job_verdict is referenced nowhere else in the
-- schema (confirmed by grep across all prior migrations).
-- =====================================================================

alter table jobs drop column if exists verdict;
drop type if exists job_verdict;

create type job_verdict as enum (
  'excellent_match',
  'strong_match',
  'worth_applying',
  'stretch_opportunity',
  'high_risk',
  'not_recommended'
);

alter table jobs add column verdict job_verdict;
