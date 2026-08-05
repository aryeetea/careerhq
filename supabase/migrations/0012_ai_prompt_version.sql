-- Tracks which version of the career-coach system prompt
-- (supabase/functions/_shared/prompts/careerCoach.ts) produced the most
-- recent AI touch on this job, so past analyses can be traced back to the
-- exact instructions that generated them.
alter table jobs add column if not exists ai_prompt_version text;
