import { z } from "zod";

const workArrangementSchema = z.union([z.enum(["remote", "hybrid", "onsite"]), z.null()]);
// excellent_match/high_risk are legacy-only — the AI no longer returns them
// (see careerCoach.ts VERDICT RULES), but they're kept here so old saved
// analyses and manually-set verdicts still validate. stretch_opportunity is
// active again as the "Stretch" tier.
const verdictSchema = z.enum([
  "excellent_match",
  "strong_match",
  "worth_applying",
  "consider",
  "stretch_opportunity",
  "high_risk",
  "not_recommended",
  "not_yet_assessed",
]);
const confidenceLevelSchema = z.enum(["low", "medium", "high"]);
const importStatusSchema = z.enum(["success", "manual_fallback"]);
const analysisSourceSchema = z.enum(["url", "manual", "url_plus_manual"]);
const opportunityAssessmentSchema = z.enum(["promising", "neutral", "risky", "ineligible"]);
const applicationRecommendationSchema = z.enum(["apply_now", "tailor_first", "consider", "skip", "upload_resume_first"]);
const resumeSuggestionTypeSchema = z.enum(["safe_wording", "reorder", "confirm_with_user", "genuine_gap"]);
const dealBreakerStatusSchema = z.enum(["confirmed", "possible", "insufficient_information"]);
const gapSeveritySchema = z.enum(["none", "minor", "moderate", "major", "hard"]);
const recommendationPrioritySchema = z.enum(["high", "normal", "backup"]);

// Five separate numeric sub-scores behind the single 0-10 fitScore, so
// "why" is inspectable — see [FIT]/detailed-scoring in AnalysisSummary.
export const scoringDimensionsSchema = z.object({
  qualificationFit: z.number().min(0).max(10).nullable(),
  transferableSkillsFit: z.number().min(0).max(10).nullable(),
  careerDirectionFit: z.number().min(0).max(10).nullable(),
  experienceSeniorityFit: z.number().min(0).max(10).nullable(),
  locationWorkArrangementFit: z.number().min(0).max(10).nullable(),
});

export const extractedJobSchema = z.object({
  company: z.string().nullable(),
  title: z.string().nullable(),
  location: z.string().nullable(),
  salary: z.string().nullable(),
  work_arrangement: workArrangementSchema,
  deadline: z.string().nullable(),
  requirements: z.array(z.string()),
  required_qualifications: z.array(z.string()),
  preferred_qualifications: z.array(z.string()),
  skills: z.array(z.string()),
  education: z.array(z.string()),
  experience: z.array(z.string()),
  certifications: z.array(z.string()),
  responsibilities: z.array(z.string()),
  raw_job_text: z.string(),
});

export const dealBreakerSchema = z.object({
  label: z.string(),
  status: dealBreakerStatusSchema,
});

// Logistics/lifestyle factors (relocation, travel, work arrangement,
// schedule, …) — separate from dealBreakers, which is scoped to genuine
// hard-eligibility issues only. See AnalysisSummary's "Things to consider".
export const logisticsConsiderationSchema = z.object({
  label: z.string(),
  detail: z.string(),
  preferenceMatch: z.enum(["aligned", "conflict", "unspecified"]),
});

// Pattern-matching on the posting text itself for common job-scam
// indicators (upfront payment requests, implausible pay for the role,
// personal-account contact instead of a company domain, pressure tactics,
// …) — not a verification that the company actually exists. See
// SCAM RED FLAGS in careerCoach.ts for the full rubric and AnalysisSummary
// for how this renders. "high"/"medium" risk is meant to prompt caution,
// never phrased as a certainty the AI can't back up from the text alone.
// webCheck reflects a real web search run server-side after the model call
// (see enrichCompanyLegitimacyWithWebCheck in the edge function's shared
// utils.ts) — "not_checked" when the company name was unknown or the
// search API wasn't reachable, never a reason the whole analysis fails.
export const companyLegitimacySchema = z.object({
  riskLevel: z.enum(["none", "low", "medium", "high"]),
  redFlags: z.array(z.string()),
  note: z.string(),
  webCheck: z.enum(["confirmed_presence", "no_presence_found", "not_checked"]),
  // The independent listing (LinkedIn, company site, job board, ...) found
  // during the web check — real information about the company, not just a
  // risk verdict. Null when nothing was found or nothing was checked.
  // Optional/defaulted (unlike webCheck above): older deployed edge
  // function responses, and analyses stored before this field existed,
  // won't include it at all — that must parse cleanly, not throw.
  source: z
    .object({ title: z.string(), url: z.string(), snippet: z.string() })
    .nullable()
    .optional()
    .transform((s) => s ?? null),
});

export const aiJobExtractionSchema = z.object({
  company: z.string().nullable(),
  jobTitle: z.string().nullable(),
  location: z.string().nullable(),
  salary: z.string().nullable(),
  employmentType: z.string().nullable(),
  workArrangement: workArrangementSchema,
  requiredQualifications: z.array(z.string()),
  preferredQualifications: z.array(z.string()),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  responsibilities: z.array(z.string()),
  educationRequirements: z.array(z.string()),
  experienceRequirements: z.array(z.string()),
  certifications: z.array(z.string()),
  dealBreakers: z.array(dealBreakerSchema),
  logisticsConsiderations: z.array(logisticsConsiderationSchema),
  companyLegitimacy: companyLegitimacySchema,
  applicationDeadline: z.string().nullable(),
  rawJobText: z.string(),
});

export const candidateFitSchema = z.object({
  fitScore: z.number().min(0).max(10).nullable(),
  confidence: confidenceLevelSchema,
  explanation: z.string(),
  strongMatches: z.array(z.string()),
  transferableStrengths: z.array(z.string()),
  criticalGaps: z.array(z.string()),
  preferredGaps: z.array(z.string()),
  unknowns: z.array(z.string()),
});

export const analysisResultSchema = z.object({
  opportunityAssessment: opportunityAssessmentSchema,
  candidateFit: candidateFitSchema,
  scoringDimensions: scoringDimensionsSchema,
  careerDirectionNote: z.string(),
  gapSeverity: gapSeveritySchema,
  recommendationPriority: recommendationPrioritySchema,
  applicationRecommendation: applicationRecommendationSchema,
  shouldApply: z.string(),
  verdict: verdictSchema,
  nextStep: z.string(),
});

export const resumeRecommendationSchema = z.object({
  resumeId: z.string().uuid(),
  resumeName: z.string(),
  compatibilityScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendationReason: z.string(),
});

export const resumeSuggestionSchema = z.object({
  type: resumeSuggestionTypeSchema,
  suggestion: z.string(),
  reason: z.string(),
});

export const jobAnalysisPayloadSchema = z.object({
  importStatus: importStatusSchema,
  source: analysisSourceSchema,
  fetchedUrl: z.string().url().nullable(),
  jobExtraction: aiJobExtractionSchema,
  analysis: analysisResultSchema,
  resumeRanking: z.array(resumeRecommendationSchema),
  recommendedResumeId: z.string().uuid().nullable(),
  resumeSuggestions: z.array(resumeSuggestionSchema),
  promptVersion: z.string(),
});
export type JobAnalysisPayload = z.infer<typeof jobAnalysisPayloadSchema>;

export const analyzeJobRequestSchema = z
  .object({
    jobId: z.string().uuid().optional(),
    jobUrl: z.string().trim().url().optional(),
    manualJobDescription: z.string().trim().optional(),
  })
  .refine((value) => Boolean(value.jobId || value.jobUrl || value.manualJobDescription), {
    message: "Provide a saved job, a job URL, or a pasted description.",
  });
export type AnalyzeJobRequest = z.infer<typeof analyzeJobRequestSchema>;

export const saveJobAnalysisRequestSchema = z.object({
  jobId: z.string().uuid(),
  analysis: jobAnalysisPayloadSchema,
  selectedResumeId: z.string().uuid().nullable(),
});
export type SaveJobAnalysisRequest = z.infer<typeof saveJobAnalysisRequestSchema>;

export const generateCoverLetterRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedResumeId: z.string().uuid().nullable().optional(),
});
export type GenerateCoverLetterRequest = z.infer<typeof generateCoverLetterRequestSchema>;

export const generateCoverLetterResponseSchema = z.object({
  cover_letter: z.string(),
  resume_id: z.string().uuid().nullable(),
  resume_name: z.string().nullable(),
});
export type GenerateCoverLetterResponse = z.infer<typeof generateCoverLetterResponseSchema>;

export const tailorResumeRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedResumeId: z.string().uuid().nullable().optional(),
});
export type TailorResumeRequest = z.infer<typeof tailorResumeRequestSchema>;

export const resumeScoreDimensionSchema = z.object({
  score: z.number().int().min(0).max(100),
  description: z.string(),
});

export const tailorResumeResponseSchema = z.object({
  resume_id: z.string().uuid().nullable(),
  resume_name: z.string().nullable(),
  overall_score: z.number().int().min(0).max(100),
  job_match: resumeScoreDimensionSchema,
  ats_readability: resumeScoreDimensionSchema,
  evidence_strength: resumeScoreDimensionSchema,
  truthfulness: resumeScoreDimensionSchema,
  covered_keywords: z.array(z.string()),
  weak_keywords: z.array(z.string()),
  missing_keywords: z.array(z.string()),
  tailored_resume: z.string(),
  summary_of_changes: z.array(z.string()),
  suggested_fixes: z.array(resumeSuggestionSchema),
});
export type TailorResumeResponse = z.infer<typeof tailorResumeResponseSchema>;

export const suggestProfileCopyRequestSchema = z.object({
  field: z.enum(["bio", "career_status"]),
});
export type SuggestProfileCopyRequest = z.infer<typeof suggestProfileCopyRequestSchema>;

export const suggestProfileCopyResponseSchema = z.object({
  field: z.enum(["bio", "career_status"]),
  suggestion: z.string(),
  reason: z.string(),
});
export type SuggestProfileCopyResponse = z.infer<typeof suggestProfileCopyResponseSchema>;

export const dailyEncouragementRequestSchema = z.object({
  // The caller's local calendar date (YYYY-MM-DD), not the server's UTC
  // date — see useDailyEncouragement for why this has to travel with the
  // request instead of being computed server-side.
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type DailyEncouragementRequest = z.infer<typeof dailyEncouragementRequestSchema>;

export const dailyEncouragementResponseSchema = z.object({
  dashboardMessage: z.string(),
  profileMessage: z.string(),
});
export type DailyEncouragementResponse = z.infer<typeof dailyEncouragementResponseSchema>;
