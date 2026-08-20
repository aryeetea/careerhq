-- =====================================================================
-- Bloom — AI resume tailoring ("Tailor Resume" tab). Given a saved job
-- and a selected resume, tailor-resume (see supabase/functions/tailor-
-- resume) scores how well the resume's existing content covers the job
-- description's ATS-relevant keywords, lists matched/missing keywords,
-- and rewrites the resume (reordered/re-emphasized, never fabricated —
-- see TAILOR_RESUME_INSTRUCTIONS in careerCoach.ts).
--
-- Stored as one JSONB blob (mirrors ai_analysis) rather than a single
-- text column like ai_cover_letter, since the response is multi-field
-- (score + keyword lists + tailored text + change summary), not just a
-- string. jobs RLS already scopes every column by user_id — no new
-- policies needed.
-- =====================================================================

alter table jobs
  add column if not exists ai_resume_tailoring jsonb,
  add column if not exists ai_resume_tailoring_updated_at timestamptz;
