import { createClient } from "npm:@supabase/supabase-js@2";
import { ZodError } from "npm:zod";
import { analysisResponseSchema, coverLetterResponseSchema } from "./schemas.ts";

const ANALYSIS_MODEL = "gpt-5.6-terra";
const EXTRACTION_MODEL = "gpt-5.6-luna";
const COVER_LETTER_MODEL = "gpt-5.6-terra";

export interface ResumeRow {
  id: string;
  name: string;
  target_role: string | null;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  extracted_text: string | null;
  extracted_text_updated_at: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface JobRow {
  id: string;
  user_id: string;
  company: string;
  title: string;
  location: string | null;
  salary: string | null;
  work_arrangement: "remote" | "hybrid" | "onsite" | null;
  job_url: string | null;
  job_description: string | null;
  deadline: string | null;
  resume_id: string | null;
  ai_extracted_data: Record<string, unknown> | null;
}

export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new AppError(`Missing required environment variable: ${name}`, 500);
  return value;
}

export function createSupabaseClients(authHeader: string | null) {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  void authHeader;
  return { adminClient };
}

export async function requireUser(authHeader: string | null) {
  if (!authHeader) throw new AppError("Authentication required.", 401);
  const { adminClient } = createSupabaseClients(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new AppError("Authentication required.", 401);
  const {
    data: { user },
    error,
  } = await adminClient.auth.getUser(token);
  if (error || !user) throw new AppError("Authentication required.", 401);
  return { user, adminClient };
}

export async function enforceRateLimit(
  adminClient: any,
  userId: string,
  action: string,
  windowMs: number,
  maxRequests: number,
) {
  const threshold = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await adminClient
    .from("ai_request_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", threshold);
  if (error) throw new AppError("Couldn't verify your rate limit right now.", 500);
  if ((count ?? 0) >= maxRequests) {
    throw new AppError("You've hit the limit for AI requests. Please wait a bit and try again.", 429);
  }

  const { error: insertError } = await adminClient.from("ai_request_logs").insert({ user_id: userId, action });
  if (insertError) throw new AppError("Couldn't verify your rate limit right now.", 500);
}

export function getOpenAIClient() {
  return {
    apiKey: getEnv("OPENAI_API_KEY"),
  };
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function htmlToText(html: string): string {
  return normalizeWhitespace(
    decodeHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function matchMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }
  return null;
}

export async function fetchJobSource(jobUrl: string | undefined, manualJobDescription: string | undefined) {
  let fetchedText = "";
  let importStatus: "success" | "manual_fallback" = "success";
  let source: "url" | "manual" | "url_plus_manual" = "manual";

  if (jobUrl) {
    try {
      const response = await fetch(jobUrl, {
        headers: {
          "User-Agent": "BloomBot/1.0 (+https://bloom.app)",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
      const html = await response.text();
      const text = htmlToText(html).slice(0, 24000);
      const metaTitle = matchMeta(html, "og:title") ?? matchMeta(html, "twitter:title");
      const metaDescription = matchMeta(html, "description") ?? matchMeta(html, "og:description");
      const pageTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
      fetchedText = normalizeWhitespace(
        [metaTitle, pageTitle, metaDescription, text]
          .filter(Boolean)
          .join("\n\n")
      );
      source = manualJobDescription ? "url_plus_manual" : "url";
    } catch {
      if (!manualJobDescription) {
        throw new AppError("We couldn't import that URL. Paste the job description to continue.", 422);
      }
      importStatus = "manual_fallback";
      source = "manual";
    }
  }

  const combined = normalizeWhitespace(
    [fetchedText, manualJobDescription?.trim() ?? ""]
      .filter(Boolean)
      .join("\n\n")
  );

  if (!combined) throw new AppError("Provide a job URL or paste the job description.", 422);

  return {
    rawText: combined.slice(0, 32000),
    importStatus,
    source,
    fetchedUrl: jobUrl ?? null,
  };
}

export async function getUserResumes(adminClient: any, userId: string): Promise<ResumeRow[]> {
  const { data, error } = await adminClient
    .from("resumes")
    .select("id,name,target_role,file_path,file_name,file_type,extracted_text,extracted_text_updated_at,is_active,notes")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (error) throw new AppError("Couldn't load your resumes right now.", 500);
  return (data ?? []) as ResumeRow[];
}

// Best-effort only: a missing/unreadable profile should never block cover
// letter generation, so this returns null on any error instead of throwing.
export async function getProfileCareerGoal(adminClient: any, userId: string): Promise<string | null> {
  const { data, error } = await adminClient.from("profiles").select("career_goal").eq("id", userId).single();
  if (error || !data) return null;
  return (data.career_goal as string | null) ?? null;
}

export async function getJobForUser(adminClient: any, userId: string, jobId: string): Promise<JobRow> {
  const { data, error } = await adminClient
    .from("jobs")
    .select("id,user_id,company,title,location,salary,work_arrangement,job_url,job_description,deadline,resume_id,ai_extracted_data")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new AppError("Job not found.", 404);
  return data as JobRow;
}

async function createOpenAIResponse(
  client: ReturnType<typeof getOpenAIClient>,
  body: Record<string, unknown>,
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${client.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AppError(`OpenAI request failed: ${errorText || response.statusText}`, 502);
  }

  return await response.json();
}

function extractResponseText(response: { output_text?: string; output?: Array<Record<string, unknown>> }): string {
  if (typeof response.output_text === "string" && response.output_text) return response.output_text;
  for (const item of response.output ?? []) {
    if ("content" in item && Array.isArray(item.content)) {
      const textItem = item.content.find((content) => typeof content === "object" && content !== null && "type" in content && content.type === "output_text");
      if (textItem && typeof textItem === "object" && textItem !== null && "text" in textItem && typeof textItem.text === "string") {
        return textItem.text;
      }
    }
  }
  return "";
}

export async function extractResumeText(client: ReturnType<typeof getOpenAIClient>, adminClient: any, resume: ResumeRow): Promise<string | null> {
  if (resume.extracted_text?.trim()) return resume.extracted_text.trim();
  if (!resume.file_path) return null;

  const { data: signed, error } = await adminClient.storage.from("resumes").createSignedUrl(resume.file_path, 60 * 10);
  if (error || !signed?.signedUrl) throw new AppError(`Couldn't access ${resume.name} for analysis.`, 500);

  const response = await createOpenAIResponse(client, {
    model: EXTRACTION_MODEL,
    reasoning: { effort: "low" },
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Extract the plain text from this resume. Return only the resume text with headings and bullets preserved when possible. Do not summarize, infer, or add content.",
          },
          {
            type: "input_file",
            file_url: signed.signedUrl,
          },
        ],
      },
    ],
  });

  const extractedText = normalizeWhitespace(extractResponseText(response)).slice(0, 24000);
  if (!extractedText) return null;

  const { error: updateError } = await adminClient
    .from("resumes")
    .update({
      extracted_text: extractedText,
      extracted_text_updated_at: new Date().toISOString(),
    })
    .eq("id", resume.id);
  if (updateError) throw new AppError("Couldn't cache extracted resume text.", 500);

  return extractedText;
}

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "company",
    "title",
    "location",
    "salary",
    "work_arrangement",
    "deadline",
    "requirements",
    "required_qualifications",
    "preferred_qualifications",
    "skills",
    "education",
    "experience",
    "certifications",
    "responsibilities",
    "raw_job_text",
    "fit_score",
    "verdict",
    "confidence_level",
    "verdict_explanation",
    "priority",
    "deal_breakers",
    "matching_strengths",
    "missing_required_qualifications",
    "missing_preferred_qualifications",
    "gaps_that_matter",
    "gaps_that_dont_matter",
    "highest_impact_next_step",
    "resume_rankings",
    "recommended_resume_id",
    "recommended_resume_reason",
    "resume_improvement_suggestions",
    "career_coach_advice",
  ],
  properties: {
    company: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    salary: { type: ["string", "null"] },
    work_arrangement: { type: ["string", "null"], enum: ["remote", "hybrid", "onsite", null] },
    deadline: { type: ["string", "null"] },
    requirements: { type: "array", items: { type: "string" } },
    required_qualifications: { type: "array", items: { type: "string" } },
    preferred_qualifications: { type: "array", items: { type: "string" } },
    skills: { type: "array", items: { type: "string" } },
    education: { type: "array", items: { type: "string" } },
    experience: { type: "array", items: { type: "string" } },
    certifications: { type: "array", items: { type: "string" } },
    responsibilities: { type: "array", items: { type: "string" } },
    raw_job_text: { type: "string" },
    fit_score: { type: "integer", minimum: 0, maximum: 10 },
    verdict: {
      type: "string",
      enum: [
        "excellent_match",
        "strong_match",
        "worth_applying",
        "stretch_opportunity",
        "high_risk",
        "not_recommended",
      ],
    },
    confidence_level: { type: "string", enum: ["low", "medium", "high"] },
    verdict_explanation: { type: "string" },
    priority: { type: "integer", enum: [1, 2, 3] },
    deal_breakers: { type: "array", items: { type: "string" } },
    matching_strengths: { type: "array", items: { type: "string" } },
    missing_required_qualifications: { type: "array", items: { type: "string" } },
    missing_preferred_qualifications: { type: "array", items: { type: "string" } },
    gaps_that_matter: { type: "array", items: { type: "string" } },
    gaps_that_dont_matter: { type: "array", items: { type: "string" } },
    highest_impact_next_step: { type: "string" },
    recommended_resume_id: { type: ["string", "null"] },
    recommended_resume_reason: { type: ["string", "null"] },
    resume_improvement_suggestions: { type: "array", items: { type: "string" } },
    career_coach_advice: { type: "string" },
    resume_rankings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["resume_id", "resume_name", "score", "explanation", "matching_strengths", "gaps"],
        properties: {
          resume_id: { type: "string" },
          resume_name: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 10 },
          explanation: { type: "string" },
          matching_strengths: { type: "array", items: { type: "string" } },
          gaps: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export async function analyzeJobAndResumes(
  client: ReturnType<typeof getOpenAIClient>,
  jobSource: { rawText: string; importStatus: "success" | "manual_fallback"; source: "url" | "manual" | "url_plus_manual"; fetchedUrl: string | null },
  resumes: Array<{ id: string; name: string; target_role: string | null; extracted_text: string }>,
) {
  const resumePayload = resumes.map((resume) => ({
    resume_id: resume.id,
    resume_name: resume.name,
    target_role: resume.target_role,
    extracted_text: resume.extracted_text.slice(0, 12000),
  }));

  const response = await createOpenAIResponse(client, {
    model: ANALYSIS_MODEL,
    reasoning: { effort: "medium" },
    text: {
      format: {
        type: "json_schema",
        name: "careerhq_job_analysis",
        strict: true,
        schema: analysisSchema,
      },
    },
    input: [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: [
              "You are Bloom's career coach: an experienced recruiter, a hiring manager, and a career coach combined. Your job is not to grade the candidate — it is to help them become a stronger candidate and to tell them, honestly, how competitive they are for THIS role.",
              "",
              "Use only evidence in the provided job text and resume text. Never fabricate experience, credentials, deadlines, or company details. Never estimate hiring odds or interview probability as a percentage. If information is absent, return null or an empty array.",
              "",
              "Evaluate holistically across every dimension the evidence supports: required qualifications, preferred qualifications, years of experience, transferable experience, education, technical skills, soft skills, portfolio/project relevance, project quality, leadership signals, certifications, industry alignment, seniority level, location requirements, and overall competitiveness. Only weigh work authorization if the job text explicitly states a requirement (e.g. \"must be authorized to work without sponsorship\") — if it does, note it as something to verify, never assume or guess the candidate's status.",
              "",
              "verdict is one of six categories — pick the one that best matches the overall picture, using fit_score as a loose anchor, not a rigid formula:",
              "  excellent_match (~9-10): exceptional alignment, minimal gaps.",
              "  strong_match (~7-8): clearly qualified, only minor gaps.",
              "  worth_applying (~5-6): solid partial fit, some real gaps but a reasonable case to apply.",
              "  stretch_opportunity (~3-4): notable gaps, but bridgeable — worth trying with eyes open.",
              "  high_risk (~2): major gaps against required qualifications; a long shot, not a lost cause.",
              "  not_recommended (~0-1): fundamental mismatch (e.g. wrong field, missing an explicit hard requirement with no workaround).",
              "confidence_level reflects how much evidence you had to work with (low if resume/job text was thin or ambiguous, high if both were detailed and specific).",
              "verdict_explanation is 2-4 sentences written directly to the candidate, in the voice of a supportive coach: name what aligns first, name the real gap if there is one, and end by saying plainly whether this is worth applying for. Never use shaming or discouraging language, and never imply the candidate has already failed.",
              "gaps_that_matter vs gaps_that_dont_matter: split the identified gaps into ones that could genuinely cost this candidate the role, and ones that are minor or easily explained/offset — be explicit, don't just restate missing_required vs missing_preferred verbatim; use judgment about what actually matters for this specific role.",
              "highest_impact_next_step is ONE concrete, specific action — the single highest-leverage thing this candidate could do before applying (e.g. reframe a specific project, quantify a specific achievement, address a specific gap) — not a generic tip.",
              "career_coach_advice closes the analysis: 2-3 sentences of direct, encouraging, realistic coaching — the kind of thing a good mentor says after reviewing the fit. It should leave the candidate more confident and clearer on what to do next, never worse than when they started reading.",
              "",
              "A deal breaker should be something explicitly required by the job that is missing or clearly unsupported by the recommended resume. Resume improvement suggestions must stay honest and focus on framing, ordering, emphasis, keywords, or clarifying already-supported experience — never invent or exaggerate anything not already in the resume.",
            ].join("\n"),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                job_source: jobSource,
                resumes: resumePayload,
                instructions: {
                  fit_score: "0 to 10 based only on evidence match and role fit.",
                  priority: "3 = high urgency/high value, 2 = normal, 1 = low priority.",
                },
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
  });

  const parsed = JSON.parse(extractResponseText(response));
  return analysisResponseSchema.parse({
    ...parsed,
    import_status: jobSource.importStatus,
    source: jobSource.source,
    fetched_url: jobSource.fetchedUrl,
    extracted_job: {
      company: parsed.company,
      title: parsed.title,
      location: parsed.location,
      salary: parsed.salary,
      work_arrangement: parsed.work_arrangement,
      deadline: parsed.deadline,
      requirements: parsed.requirements,
      required_qualifications: parsed.required_qualifications,
      preferred_qualifications: parsed.preferred_qualifications,
      skills: parsed.skills,
      education: parsed.education,
      experience: parsed.experience,
      certifications: parsed.certifications,
      responsibilities: parsed.responsibilities,
      raw_job_text: parsed.raw_job_text,
    },
  });
}

const coverLetterSchema = {
  type: "object",
  additionalProperties: false,
  required: ["cover_letter", "resume_id", "resume_name"],
  properties: {
    cover_letter: { type: "string" },
    resume_id: { type: ["string", "null"] },
    resume_name: { type: ["string", "null"] },
  },
} as const;

export async function generateCoverLetterText(
  client: ReturnType<typeof getOpenAIClient>,
  params: {
    job: JobRow;
    selectedResume: { id: string; name: string; extractedText: string } | null;
    analysis: unknown;
    rawJobText: string;
    careerGoal: string | null;
  },
) {
  const response = await createOpenAIResponse(client, {
    model: COVER_LETTER_MODEL,
    reasoning: { effort: "low" },
    text: {
      format: {
        type: "json_schema",
        name: "careerhq_cover_letter",
        strict: true,
        schema: coverLetterSchema,
      },
    },
    input: [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: [
              "Write a concise, honest cover letter draft in the applicant's voice. Use only evidence present in the provided resume text and job text. Do not invent metrics, titles, tools, or experience — if the resume doesn't support a claim, leave it out.",
              "Reference specifics: the company and role by name, one or two concrete projects or achievements pulled from the resume, the applicant's career goal if one was provided (naturally, not as a bolted-on sentence), and the experience most relevant to this specific job's responsibilities.",
              "Avoid clichés and anything that reads as AI-generated boilerplate. Do not open with \"I am writing to express my interest in...\". Do not use stock phrases like \"team player\", \"results-driven professional\", \"proven track record\", \"passionate about leveraging\", or \"dynamic environment\". Write the way a thoughtful person would actually write about their own work.",
              "3 to 5 short paragraphs, warm but professional, ready for the applicant to review and send.",
            ].join("\n"),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                job: {
                  company: params.job.company,
                  title: params.job.title,
                  location: params.job.location,
                },
                selected_resume: params.selectedResume
                  ? {
                      resume_id: params.selectedResume.id,
                      resume_name: params.selectedResume.name,
                      extracted_text: params.selectedResume.extractedText.slice(0, 12000),
                    }
                  : null,
                analysis: params.analysis,
                raw_job_text: params.rawJobText.slice(0, 18000),
                applicant_career_goal: params.careerGoal,
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
  });

  return coverLetterResponseSchema.parse(JSON.parse(extractResponseText(response)));
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: error.message } };
  }
  if (error instanceof ZodError) {
    return { status: 400, body: { error: "Invalid request or model response.", details: error.flatten() } };
  }
  console.error(error);
  return { status: 500, body: { error: "Something went wrong while running the AI workflow." } };
}
