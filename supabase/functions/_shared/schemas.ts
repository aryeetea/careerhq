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

const verdictEnum = z.enum([
  "excellent_match",
  "strong_match",
  "worth_applying",
  "stretch_opportunity",
  "high_risk",
  "not_recommended",
]);

export const dealBreakerSchema = z.object({
  label: z.string(),
  status: z.enum(["confirmed", "possible", "insufficient_information"]),
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
  applicationDeadline: z.string().nullable(),
  rawJobText: z.string(),
});

export const categoryScoreSchema = z.object({
  category: z.string(),
  label: z.string(),
  rawScore: z.number().int().min(0).max(10),
  weight: z.number().min(0).max(1),
  weightedContribution: z.number().min(0).max(10),
  evidence: z.array(z.string()),
  notes: z.string(),
});

export const analysisResultSchema = z.object({
  // fitScore and rubricVersion are computed by the app (rubric.ts), not by the model.
  fitScore: z.number().min(0).max(10),
  rubricVersion: z.string(),
  categoryScores: z.array(categoryScoreSchema),
  confidence: z.enum(["high", "medium", "low"]),
  verdict: verdictEnum,
  verdictExplanation: z.string(),
  strongMatches: z.array(z.string()),
  transferableStrengths: z.array(z.string()),
  criticalGaps: z.array(z.string()),
  preferredGaps: z.array(z.string()),
  unknowns: z.array(z.string()),
  scoreIncreases: z.array(z.string()),
  scoreReductions: z.array(z.string()),
  applicationPriority: z.enum(["apply_now", "apply_soon", "consider", "skip"]),
  careerCoachAdvice: z.string(),
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

export type AnalyzeJobRequest = z.infer<typeof analyzeJobRequestSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type CoverLetterRequest = z.infer<typeof coverLetterRequestSchema>;
