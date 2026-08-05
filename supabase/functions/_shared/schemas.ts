import { z } from "npm:zod";

export const analyzeJobRequestSchema = z
  .object({
    jobId: z.string().uuid().optional(),
    jobUrl: z.string().trim().url().optional(),
    manualJobDescription: z.string().trim().min(1).optional(),
  })
  .refine((value) => Boolean(value.jobUrl || value.manualJobDescription || value.jobId), {
    message: "Provide a job URL, a pasted description, or a saved job id.",
  });

export const resumeRecommendationSchema = z.object({
  resume_id: z.string().uuid(),
  resume_name: z.string(),
  score: z.number().int().min(0).max(10),
  explanation: z.string(),
  matching_strengths: z.array(z.string()),
  gaps: z.array(z.string()),
});

export const analysisResponseSchema = z.object({
  import_status: z.enum(["success", "manual_fallback"]),
  source: z.enum(["url", "manual", "url_plus_manual"]),
  fetched_url: z.string().url().nullable(),
  extracted_job: z.object({
    company: z.string().nullable(),
    title: z.string().nullable(),
    location: z.string().nullable(),
    salary: z.string().nullable(),
    work_arrangement: z.enum(["remote", "hybrid", "onsite"]).nullable(),
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
  }),
  fit_score: z.number().int().min(0).max(10),
  verdict: z.enum(["apply", "maybe", "skip"]),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  deal_breakers: z.array(z.string()),
  matching_strengths: z.array(z.string()),
  missing_required_qualifications: z.array(z.string()),
  missing_preferred_qualifications: z.array(z.string()),
  resume_rankings: z.array(resumeRecommendationSchema),
  recommended_resume_id: z.string().uuid().nullable(),
  recommended_resume_reason: z.string().nullable(),
  resume_improvement_suggestions: z.array(z.string()),
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
