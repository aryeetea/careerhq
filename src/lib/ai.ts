import { z } from "zod";

const workArrangementSchema = z.union([z.enum(["remote", "hybrid", "onsite"]), z.null()]);
const verdictSchema = z.enum(["apply", "maybe", "skip"]);

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

export const resumeRecommendationSchema = z.object({
  resume_id: z.string(),
  resume_name: z.string(),
  score: z.number().int().min(0).max(10),
  explanation: z.string(),
  matching_strengths: z.array(z.string()),
  gaps: z.array(z.string()),
});

export const jobAnalysisPayloadSchema = z.object({
  import_status: z.enum(["success", "manual_fallback"]),
  source: z.enum(["url", "manual", "url_plus_manual"]),
  fetched_url: z.string().url().nullable(),
  extracted_job: extractedJobSchema,
  fit_score: z.number().int().min(0).max(10),
  verdict: verdictSchema,
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  deal_breakers: z.array(z.string()),
  matching_strengths: z.array(z.string()),
  missing_required_qualifications: z.array(z.string()),
  missing_preferred_qualifications: z.array(z.string()),
  resume_rankings: z.array(resumeRecommendationSchema),
  recommended_resume_id: z.string().nullable(),
  recommended_resume_reason: z.string().nullable(),
  resume_improvement_suggestions: z.array(z.string()),
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
