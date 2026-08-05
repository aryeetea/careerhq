import { z } from "zod";

const workArrangementSchema = z.union([z.enum(["remote", "hybrid", "onsite"]), z.null()]);
const verdictSchema = z.enum([
  "excellent_match",
  "strong_match",
  "worth_applying",
  "stretch_opportunity",
  "high_risk",
  "not_recommended",
]);
const confidenceLevelSchema = z.enum(["low", "medium", "high"]);
const importStatusSchema = z.enum(["success", "manual_fallback"]);
const analysisSourceSchema = z.enum(["url", "manual", "url_plus_manual"]);
const applicationPrioritySchema = z.enum(["apply_now", "apply_soon", "consider", "skip"]);
const resumeSuggestionTypeSchema = z.enum(["safe_wording", "reorder", "confirm_with_user", "genuine_gap"]);
const dealBreakerStatusSchema = z.enum(["confirmed", "possible", "insufficient_information"]);
const scoringCategorySchema = z.enum([
  "required_qualifications",
  "relevant_experience",
  "relevant_skills",
  "education_certifications",
  "projects_portfolio",
  "preferred_qualifications",
  "seniority_alignment",
  "location_logistics",
]);

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
  applicationDeadline: z.string().nullable(),
  rawJobText: z.string(),
});

export const categoryScoreSchema = z.object({
  category: scoringCategorySchema,
  label: z.string(),
  rawScore: z.number().int().min(0).max(10),
  weight: z.number().min(0).max(1),
  weightedContribution: z.number().min(0).max(10),
  evidence: z.array(z.string()),
  notes: z.string(),
});
export type CategoryScore = z.infer<typeof categoryScoreSchema>;

export const analysisResultSchema = z.object({
  // fitScore and rubricVersion are app-calculated from categoryScores.
  fitScore: z.number().min(0).max(10),
  rubricVersion: z.string(),
  categoryScores: z.array(categoryScoreSchema),
  confidence: confidenceLevelSchema,
  verdict: verdictSchema,
  verdictExplanation: z.string(),
  strongMatches: z.array(z.string()),
  transferableStrengths: z.array(z.string()),
  criticalGaps: z.array(z.string()),
  preferredGaps: z.array(z.string()),
  unknowns: z.array(z.string()),
  scoreIncreases: z.array(z.string()),
  scoreReductions: z.array(z.string()),
  applicationPriority: applicationPrioritySchema,
  careerCoachAdvice: z.string(),
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
