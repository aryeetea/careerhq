-- =====================================================================
-- Bloom — AI job evaluation redesign.
--
-- Problem this fixes: the AI evaluation treated relocation/travel/on-site
-- requirements exactly like a missing required degree — both landed in
-- jobExtraction.dealBreakers, and normalizeAndValidateAnalysis() blocked
-- any positive verdict once a "confirmed" deal breaker existed, regardless
-- of whether it was a genuine eligibility blocker or just a lifestyle
-- consideration the candidate might be fine with. That's why a 7/10-fit
-- Entry-Level PM role at Epic came back "Not Recommended" over relocation
-- and travel alone.
--
-- 1. `consider` joins the verdict taxonomy as the fourth tier between
--    worth_applying and not_recommended (see careerCoach.ts VERDICT
--    RULES). The five older values (excellent_match, stretch_opportunity,
--    high_risk included) are left in place — old rows keep rendering
--    correctly and they're still manually selectable — but the AI prompt
--    and its strict JSON schema only ask the model for the new four (plus
--    not_yet_assessed) going forward.
-- 2. jobs.verdict_source distinguishes an AI-authored verdict/fit score
--    from one the user picked by hand, so a later re-analysis never
--    silently overwrites a manual override (see analyze-job/index.ts).
--    Existing rows that already carry a verdict are backfilled to 'ai'
--    since every verdict before this migration came from the AI.
-- 3. settings gains three logistics preferences (relocation, travel, work
--    arrangement). Unset (null) means "not specified" — the evaluator
--    treats that as "flag it as a consideration," never as an automatic
--    rejection. See the CANDIDATE PREFERENCES section of careerCoach.ts.
-- =====================================================================

alter type job_verdict add value if not exists 'consider';

alter table jobs
  add column if not exists verdict_source text,
  add constraint jobs_verdict_source_check
    check (verdict_source is null or verdict_source in ('ai', 'user'));

comment on column jobs.verdict_source is
  'Who authored the current verdict/fit_score pair: ai (from analyze-job) or user (manually edited). Null means never set. A later AI re-analysis must not overwrite a ''user''-sourced verdict/fit_score.';

update jobs
set verdict_source = 'ai'
where verdict is not null and verdict_source is null;

alter table settings
  add column if not exists relocation_preference text,
  add constraint settings_relocation_preference_check
    check (relocation_preference is null or relocation_preference in ('open', 'not_open')),
  add column if not exists travel_preference text,
  add constraint settings_travel_preference_check
    check (travel_preference is null or travel_preference in ('comfortable', 'limited', 'not_comfortable')),
  add column if not exists work_arrangement_preference text,
  add constraint settings_work_arrangement_preference_check
    check (work_arrangement_preference is null or work_arrangement_preference in ('remote_only', 'hybrid_ok', 'onsite_ok', 'flexible'));

comment on column settings.relocation_preference is 'Candidate''s stated comfort with relocating for a role. Null = not specified, treated as a consideration rather than a rejection.';
comment on column settings.travel_preference is 'Candidate''s stated comfort with job-related travel. Null = not specified.';
comment on column settings.work_arrangement_preference is 'Candidate''s stated work-mode preference (e.g. remote_only). Null = not specified.';
