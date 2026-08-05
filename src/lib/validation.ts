import { z } from "zod";

export const emailSchema = z.string().trim().min(1, "Email is required").email("Enter a valid email address");
export const passwordSchema = z.string().min(8, "Use at least 8 characters");

export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(1, "Tell us what to call you").max(60),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type SignUpValues = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(24, "24 characters max")
  .regex(/^[a-z0-9_.]+$/, "Lowercase letters, numbers, \".\" and \"_\" only");

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name").max(60),
  username: usernameSchema,
  careerGoal: z.string().trim().max(280).optional().or(z.literal("")),
  primaryJobTitles: z.array(z.string().trim().min(1)).max(10).default([]),
  preferredLocations: z.array(z.string().trim().min(1)).max(10).default([]),
  weeklyApplicationGoal: z.coerce.number().int().min(0).max(200).default(5),
  sharingEnabled: z.boolean().default(false),
});
export type OnboardingValues = z.infer<typeof onboardingSchema>;

export const jobBasicsSchema = z.object({
  company: z.string().trim().min(1, "Company is required").max(160),
  title: z.string().trim().min(1, "Job title is required").max(200),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  workArrangement: z.union([z.enum(["remote", "hybrid", "onsite"]), z.literal("")]).optional(),
  employmentType: z.union([z.enum(["full_time", "part_time", "contract", "internship", "temporary"]), z.literal("")]).optional(),
  salary: z.string().trim().max(120).optional().or(z.literal("")),
  source: z.string().trim().max(120).optional().or(z.literal("")),
  jobUrl: z.string().trim().max(500).optional().or(z.literal("")),
  jobDescription: z.string().trim().max(20000).optional().or(z.literal("")),
});

export const jobFormSchema = jobBasicsSchema.extend({
  status: z.enum([
    "saved",
    "applying",
    "applied",
    "assessment",
    "recruiter_contacted",
    "interview",
    "final_interview",
    "offer",
    "rejected",
    "ghosted",
    "closed",
    "archived",
  ]),
  verdict: z
    .union([
      z.enum([
        "excellent_match",
        "strong_match",
        "worth_applying",
        "stretch_opportunity",
        "high_risk",
        "not_recommended",
      ]),
      z.literal(""),
    ])
    .optional(),
  // Registered with setValueAs (see AddJobDialog/JobDetailDialog) so an empty
  // input becomes null rather than coercing "" -> 0.
  fitScore: z.number().min(0).max(10).nullable().optional(),
  resumeId: z.string().optional().or(z.literal("")),
  coverLetterUsed: z.string().trim().max(2000).optional().or(z.literal("")),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  deadline: z.string().optional().or(z.literal("")),
  followUpDate: z.string().optional().or(z.literal("")),
  interviewDate: z.string().optional().or(z.literal("")),
  offerDate: z.string().optional().or(z.literal("")),
  rejectionDate: z.string().optional().or(z.literal("")),
  recruiterName: z.string().trim().max(160).optional().or(z.literal("")),
  recruiterEmail: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional(),
  recruiterLinkedin: z.string().trim().max(300).optional().or(z.literal("")),
  strengths: z.string().trim().max(4000).optional().or(z.literal("")),
  missingQualifications: z.string().trim().max(4000).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});
export type JobFormValues = z.infer<typeof jobFormSchema>;

export const resumeFormSchema = z.object({
  name: z.string().trim().min(1, "Name this resume").max(120),
  targetRole: z.string().trim().max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type ResumeFormValues = z.infer<typeof resumeFormSchema>;

export const certificationFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  provider: z.string().trim().max(160).optional().or(z.literal("")),
  status: z.enum(["not_started", "in_progress", "completed", "expired"]).default("not_started"),
  progressPercentage: z.coerce.number().int().min(0).max(100).default(0),
  startDate: z.string().optional().or(z.literal("")),
  targetCompletionDate: z.string().optional().or(z.literal("")),
  completionDate: z.string().optional().or(z.literal("")),
  expirationDate: z.string().optional().or(z.literal("")),
  courseLink: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CertificationFormValues = z.infer<typeof certificationFormSchema>;

export const goalFormSchema = z.object({
  name: z.string().trim().min(1, "Give this goal a name").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  targetCount: z.coerce.number().int().min(1).max(500).default(5),
  unit: z.string().trim().min(1).max(40).default("applications"),
  deadline: z.string().optional().or(z.literal("")),
  isShared: z.boolean().default(false),
});
export type GoalFormValues = z.infer<typeof goalFormSchema>;

export const groupFormSchema = z.object({
  name: z.string().trim().min(1, "Give this group a name").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  weeklyGoalTarget: z.coerce.number().int().min(0).max(500).optional().nullable(),
});
export type GroupFormValues = z.infer<typeof groupFormSchema>;

export const profileFormSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name").max(60),
  bio: z.string().trim().optional().or(z.literal("")),
  careerGoal: z.string().trim().max(280).optional().or(z.literal("")),
  careerStatus: z.string().trim().optional().or(z.literal("")),
  skills: z.array(z.string().trim().min(1)).max(20).default([]),
  primaryJobTitles: z.array(z.string().trim().min(1)).max(10).default([]),
  preferredLocations: z.array(z.string().trim().min(1)).max(10).default([]),
  weeklyApplicationGoal: z.coerce.number().int().min(0).max(200).default(5),
  statusMessage: z.string().trim().optional().or(z.literal("")),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

// ---------------------------------------------------------------------
// Import/export
// ---------------------------------------------------------------------
export const jobExportSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().nullable().optional(),
  salary: z.string().nullable().optional(),
  work_arrangement: z.string().nullable().optional(),
  employment_type: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  job_url: z.string().nullable().optional(),
  job_description: z.string().nullable().optional(),
  status: z.string().optional(),
  verdict: z.string().nullable().optional(),
  fit_score: z.number().nullable().optional(),
  priority: z.number().optional(),
  notes: z.string().nullable().optional(),
  date_found: z.string().optional(),
  date_applied: z.string().nullable().optional(),
  follow_up_date: z.string().nullable().optional(),
  recruiter_name: z.string().nullable().optional(),
  recruiter_email: z.string().nullable().optional(),
  recruiter_linkedin: z.string().nullable().optional(),
  strengths: z.string().nullable().optional(),
  missing_qualifications: z.string().nullable().optional(),
  cover_letter_used: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  interview_date: z.string().nullable().optional(),
  offer_date: z.string().nullable().optional(),
  rejection_date: z.string().nullable().optional(),
});

const certificationExportSchema = z.object({
  name: z.string(),
  provider: z.string().nullable().optional(),
  status: z.string().optional(),
  progress_percentage: z.number().optional(),
  start_date: z.string().nullable().optional(),
  target_completion_date: z.string().nullable().optional(),
  completion_date: z.string().nullable().optional(),
  expiration_date: z.string().nullable().optional(),
  course_link: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const goalExportSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  target_count: z.number().optional(),
  unit: z.string().optional(),
  deadline: z.string().nullable().optional(),
  is_shared: z.boolean().optional(),
});

export const backupSchema = z.discriminatedUnion("version", [
  z.object({
    version: z.literal(1),
    exportedAt: z.string(),
    jobs: z.array(jobExportSchema),
    certifications: z.array(certificationExportSchema).default([]),
  }),
  z.object({
    version: z.literal(2),
    exportedAt: z.string(),
    jobs: z.array(jobExportSchema),
    certifications: z.array(certificationExportSchema).default([]),
    goals: z.array(goalExportSchema).default([]),
  }),
]);
export type BackupData = z.infer<typeof backupSchema>;
