import { z } from "npm:zod";

export const analyzeJobRequestSchema = z
  .object({
    jobId: z.string().uuid().optional(),
    jobUrl: z.string().trim().url().optional(),
    manualJobDescription: z.string().trim().min(1).max(20000).optional(),
  })
  .refine((value) => Boolean(value.jobUrl || value.manualJobDescription || value.jobId), {
    message: "Provide a job URL, a pasted description, or a saved job id.",
  });

// The DB enum (job_verdict) and this zod enum keep excellent_match and
// high_risk as legacy-only values so old rows and manual selection keep
// working — see migration 0040. stretch_opportunity is active again as the
// fifth tier ("Stretch" — see VERDICT RULES in careerCoach.ts): strong_match
// / worth_applying / consider / stretch_opportunity / not_recommended /
// not_yet_assessed is the full active set the model now picks from.
const verdictEnum = z.enum([
  "excellent_match",
  "strong_match",
  "worth_applying",
  "consider",
  "stretch_opportunity",
  "high_risk",
  "not_recommended",
  "not_yet_assessed",
]);

const opportunityAssessmentEnum = z.enum(["promising", "neutral", "risky", "ineligible"]);
const applicationRecommendationEnum = z.enum(["apply_now", "tailor_first", "consider", "skip", "upload_resume_first"]);
// How seriously a missing specialized qualification should weigh on the
// verdict — "none" when there's nothing meaningful missing. Only "hard"
// (a requirement the candidate cannot reasonably satisfy) should push a
// verdict toward not_recommended; minor/moderate/major gaps on their own
// must not.
const gapSeverityEnum = z.enum(["none", "minor", "moderate", "major", "hard"]);
// Advisory only, separate from both jobs.priority (the user's own manual
// 1-3 urgency ranking) and applicationRecommendation (apply_now/tailor_
// first/…). Reflects how strong an application opportunity this is overall
// — distinct from careerDirectionFit, since a role outside someone's ideal
// direction can still be worth a normal or even high-priority application.
const recommendationPriorityEnum = z.enum(["high", "normal", "backup"]);

// The 0-10 fit score stays the single headline number, but it's now backed
// by five separate sub-scores so "why" is inspectable rather than one
// opaque figure. requirementGaps and hardRequirements aren't scores here —
// they're covered by candidateFit's gap lists and jobExtraction.dealBreakers
// respectively, so this only covers the five genuinely numeric dimensions.
export const scoringDimensionsSchema = z.object({
  qualificationFit: z.number().min(0).max(10).nullable(),
  transferableSkillsFit: z.number().min(0).max(10).nullable(),
  careerDirectionFit: z.number().min(0).max(10).nullable(),
  experienceSeniorityFit: z.number().min(0).max(10).nullable(),
  locationWorkArrangementFit: z.number().min(0).max(10).nullable(),
});

// Scoped to genuine hard-eligibility issues only (missing required degree,
// license, work authorization, a clearly-stated mandatory years-of-experience
// bar, or another explicit non-negotiable requirement). Logistics/lifestyle
// factors — relocation, travel, on-site/hybrid, geography, schedule — are a
// separate concept; see logisticsConsiderationSchema below. Conflating the
// two is what previously made relocation/travel alone trigger "Not
// Recommended" verdicts (see normalizeAndValidateAnalysis in utils.ts).
export const dealBreakerSchema = z.object({
  label: z.string(),
  status: z.enum(["confirmed", "possible", "insufficient_information"]),
});

// Logistics/lifestyle factors that may affect whether the candidate WANTS
// the job — never whether they're qualified for it. preferenceMatch is
// computed against the candidate's saved settings preferences (relocation/
// travel/work-arrangement): "conflict" only when the user has explicitly
// said they don't want that logistics factor; "unspecified" when they
// haven't said either way (the default — never treated as a rejection).
export const logisticsConsiderationSchema = z.object({
  label: z.string(),
  detail: z.string(),
  preferenceMatch: z.enum(["aligned", "conflict", "unspecified"]),
});

export const resumeRankingSchema = z.object({
  resumeId: z.string().uuid(),
  resumeName: z.string(),
  compatibilityScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendationReason: z.string(),
});

export const resumeSuggestionSchema = z.object({
  type: z.enum(["safe_wording", "reorder", "confirm_with_user", "genuine_gap"]),
  suggestion: z.string(),
  reason: z.string(),
});

export const jobExtractionSchema = z.object({
  company: z.string().nullable(),
  jobTitle: z.string().nullable(),
  location: z.string().nullable(),
  salary: z.string().nullable(),
  employmentType: z.string().nullable(),
  workArrangement: z.enum(["remote", "hybrid", "onsite"]).nullable(),
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
  applicationDeadline: z.string().nullable(),
  rawJobText: z.string(),
});

export const candidateFitSchema = z.object({
  fitScore: z.number().min(0).max(10).nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  explanation: z.string(),
  strongMatches: z.array(z.string()),
  transferableStrengths: z.array(z.string()),
  criticalGaps: z.array(z.string()),
  preferredGaps: z.array(z.string()),
  unknowns: z.array(z.string()),
});

export const analysisResultSchema = z.object({
  opportunityAssessment: opportunityAssessmentEnum,
  candidateFit: candidateFitSchema,
  scoringDimensions: scoringDimensionsSchema,
  // Short (1-2 sentence), grounded explanation of the careerDirectionFit
  // number — e.g. why this role sits closer to or further from the
  // candidate's stated target roles. Never generic filler.
  careerDirectionNote: z.string(),
  gapSeverity: gapSeverityEnum,
  recommendationPriority: recommendationPriorityEnum,
  applicationRecommendation: applicationRecommendationEnum,
  // A direct, concise answer to "should I apply?" — distinct from nextStep
  // (the single highest-impact next action). E.g. "Apply if you're
  // comfortable tailoring your resume toward X, Y, Z."
  shouldApply: z.string(),
  verdict: verdictEnum,
  nextStep: z.string(),
});

export const analysisResponseSchema = z.object({
  importStatus: z.enum(["success", "manual_fallback"]),
  source: z.enum(["url", "manual", "url_plus_manual"]),
  fetchedUrl: z.string().url().nullable(),
  jobExtraction: jobExtractionSchema,
  analysis: analysisResultSchema,
  resumeRanking: z.array(resumeRankingSchema),
  recommendedResumeId: z.string().uuid().nullable(),
  resumeSuggestions: z.array(resumeSuggestionSchema),
  promptVersion: z.string(),
});

export const coverLetterRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedResumeId: z.string().uuid().nullable().optional(),
});

export const coverLetterResponseSchema = z.object({
  cover_letter: z.string().min(1),
  resume_id: z.string().uuid().nullable(),
  resume_name: z.string().nullable(),
});

export const suggestProfileCopyRequestSchema = z.object({
  field: z.enum(["bio", "career_status"]),
});

export const suggestProfileCopyResponseSchema = z.object({
  field: z.enum(["bio", "career_status"]),
  suggestion: z.string(),
  reason: z.string(),
});

export type AnalyzeJobRequest = z.infer<typeof analyzeJobRequestSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type CoverLetterRequest = z.infer<typeof coverLetterRequestSchema>;
export type SuggestProfileCopyRequest = z.infer<typeof suggestProfileCopyRequestSchema>;
export type SuggestProfileCopyResponse = z.infer<typeof suggestProfileCopyResponseSchema>;
