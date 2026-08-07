import { createClient } from "npm:@supabase/supabase-js@2";
import { ZodError } from "npm:zod";
import { analysisResponseSchema, coverLetterResponseSchema, type AnalysisResponse } from "./schemas.ts";
import { buildAnalysisPrompt, buildCoverLetterPrompt, CAREER_COACH_PROMPT_VERSION } from "./prompts/careerCoach.ts";

const ANALYSIS_MODEL = "gpt-5.6-terra";
const EXTRACTION_MODEL = "gpt-5.6-luna";
const COVER_LETTER_MODEL = "gpt-5.6-terra";
const MAX_RESUMES_PER_REQUEST = 10;

const ANALYSIS_TIMEOUT_MS = 120_000;
const EXTRACTION_TIMEOUT_MS = 45_000;
const COVER_LETTER_TIMEOUT_MS = 60_000;
// Maximum 5xx retries; 4xx and auth errors are never retried.
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = [1_000, 2_000];
const POSITIVE_VERDICTS = new Set(["excellent_match", "strong_match", "worth_applying"]);
const HIGH_MATCH_VERDICTS = new Set(["excellent_match", "strong_match"]);
// Confirmed dealBreakers (hard-requirement issues only, post redesign) block
// a positive verdict. Logistics/lifestyle labels — relocation, travel,
// on-site/hybrid, geography, schedule — must never land in dealBreakers;
// this is the code-level backstop for that, on top of the prompt telling
// the model to put them in logisticsConsiderations instead. This is what
// used to make relocation/travel alone force a "Not Recommended" verdict.
const LOGISTICS_KEYWORD_PATTERN =
  /\b(relocat|travel|on-?site|onsite|hybrid|remote|commut|time ?zone|geographic|shift|schedule)\b/i;

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
  verdict: string | null;
  fit_score: number | null;
  // 'user' means the verdict/fit_score were set (or kept) by hand — see
  // migration 0040. analyze-job must never overwrite them in that case.
  verdict_source: "ai" | "user" | null;
}

export type AppErrorCode =
  | "validation_error"
  | "unauthenticated"
  | "not_found"
  | "rate_limited"
  | "upstream_error"
  | "internal_error"
  | "not_configured"
  | "insufficient_context";

export class AppError extends Error {
  status: number;
  code: AppErrorCode;

  constructor(message: string, status = 400, code: AppErrorCode = "validation_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new AppError(`Missing required environment variable: ${name}`, 500, "internal_error");
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
  if (!authHeader) throw new AppError("Authentication required.", 401, "unauthenticated");
  const { adminClient } = createSupabaseClients(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new AppError("Authentication required.", 401, "unauthenticated");
  const {
    data: { user },
    error,
  } = await adminClient.auth.getUser(token);
  if (error || !user) throw new AppError("Authentication required.", 401, "unauthenticated");
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
  if (error) throw new AppError("Couldn't verify your rate limit right now.", 500, "internal_error");
  if ((count ?? 0) >= maxRequests) {
    throw new AppError("You've hit the limit for AI requests. Please wait a bit and try again.", 429, "rate_limited");
  }

  const { error: insertError } = await adminClient.from("ai_request_logs").insert({ user_id: userId, action });
  if (insertError) throw new AppError("Couldn't verify your rate limit right now.", 500, "internal_error");
}

// Deliberately does not reuse getEnv() here: getEnv()'s message includes the
// literal variable name, which is an implementation detail we don't want
// reaching the browser. A missing key is also a distinct, actionable state
// for the client (config not done yet) rather than a generic 500.
export function getOpenAIClient() {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new AppError("AI suggestions haven't been configured yet.", 500, "not_configured");
  }
  return { apiKey };
}

export interface CandidateEvidenceContext {
  hasResumeEvidence: boolean;
  hasProfileEvidence: boolean;
}

// Mirrors settings.relocation_preference / travel_preference /
// work_arrangement_preference (see migration 0040). Null = not specified.
export interface CandidatePreferences {
  relocationPreference: "open" | "not_open" | null;
  travelPreference: "comfortable" | "limited" | "not_comfortable" | null;
  workArrangementPreference: "remote_only" | "hybrid_ok" | "onsite_ok" | "flexible" | null;
}

function withMissingEvidenceUnknowns(existing: string[], context: CandidateEvidenceContext): string[] {
  const unknowns = [...existing];
  if (!context.hasResumeEvidence) unknowns.push("No resume evidence was available to assess your fit.");
  if (!context.hasProfileEvidence) unknowns.push("No profile evidence was available to assess your fit.");
  return Array.from(new Set(unknowns));
}

export function normalizeAndValidateAnalysis(response: AnalysisResponse, context: CandidateEvidenceContext): AnalysisResponse {
  const hasCandidateEvidence = context.hasResumeEvidence || context.hasProfileEvidence;
  const normalized = structuredClone(response) as AnalysisResponse;
  const verdict = normalized.analysis.verdict;
  const confirmedDealBreakers = response.jobExtraction.dealBreakers.filter((item) => item.status === "confirmed");
  const criticalGapCount = normalized.analysis.candidateFit.criticalGaps.length;
  const issues: string[] = [];

  // Code-level backstop for the Epic Entry-Level PM bug: relocation/travel/
  // on-site-type labels must be reported as logisticsConsiderations, never
  // as dealBreakers — dealBreakers alone gate a positive verdict below, and
  // logistics should never be able to force "Not Recommended" on their own.
  const misclassifiedLogistics = normalized.jobExtraction.dealBreakers.filter(
    (item) => LOGISTICS_KEYWORD_PATTERN.test(item.label)
  );
  if (misclassifiedLogistics.length > 0) {
    issues.push(
      `logistics/lifestyle items belong in logisticsConsiderations, not dealBreakers: ${misclassifiedLogistics.map((item) => item.label).join(", ")}`,
    );
  }

  if (!hasCandidateEvidence) {
    normalized.analysis.candidateFit.fitScore = null;
    normalized.analysis.candidateFit.confidence = "low";
    normalized.analysis.candidateFit.explanation =
      "Fit not assessed yet because no resume or profile evidence was available. Upload or select a resume to assess your fit against this role.";
    normalized.analysis.candidateFit.strongMatches = [];
    normalized.analysis.candidateFit.transferableStrengths = [];
    normalized.analysis.candidateFit.criticalGaps = [];
    normalized.analysis.candidateFit.preferredGaps = [];
    normalized.analysis.candidateFit.unknowns = withMissingEvidenceUnknowns(normalized.analysis.candidateFit.unknowns, context);
    normalized.analysis.verdict = "not_yet_assessed";
    normalized.analysis.applicationRecommendation = "upload_resume_first";
  }

  if (normalized.analysis.candidateFit.fitScore === null) {
    normalized.analysis.verdict = "not_yet_assessed";
    if (!hasCandidateEvidence) normalized.analysis.applicationRecommendation = "upload_resume_first";
  }

  if (normalized.analysis.verdict === "excellent_match" && criticalGapCount > 0) {
    issues.push("excellent_match cannot include criticalGaps because the prompt defines it as meeting nearly all required qualifications");
  }

  if (POSITIVE_VERDICTS.has(normalized.analysis.verdict) && confirmedDealBreakers.length > 0) {
    issues.push(
      `positive verdict "${normalized.analysis.verdict}" conflicts with confirmed deal breakers: ${confirmedDealBreakers.map((item) => item.label).join(", ")}`,
    );
  }

  if (HIGH_MATCH_VERDICTS.has(normalized.analysis.verdict) && !hasCandidateEvidence) {
    issues.push(`${normalized.analysis.verdict} requires actual resume or profile evidence`);
  }

  if (normalized.analysis.verdict === "not_recommended" && confirmedDealBreakers.length === 0 && criticalGapCount === 0) {
    issues.push("not_recommended requires confirmed hard gaps or clear critical misalignment");
  }

  if (
    normalized.analysis.applicationRecommendation === "skip" &&
    confirmedDealBreakers.length === 0 &&
    normalized.analysis.opportunityAssessment !== "ineligible" &&
    criticalGapCount === 0
  ) {
    issues.push("skip recommendation requires confirmed ineligibility or critical gaps");
  }

  if (normalized.analysis.applicationRecommendation === "apply_now" && confirmedDealBreakers.length > 0) {
    issues.push("apply_now cannot coexist with confirmed ineligibility");
  }

  if (
    normalized.analysis.verdict === "worth_applying" &&
    normalized.analysis.candidateFit.fitScore !== null &&
    normalized.analysis.candidateFit.fitScore <= 0
  ) {
    issues.push("worth_applying cannot appear with a 0/10 score");
  }

  if (normalized.analysis.candidateFit.fitScore === 0 && normalized.analysis.candidateFit.unknowns.length > 0 && criticalGapCount === 0) {
    issues.push("unknowns must reduce confidence, not collapse fit to zero");
  }

  if (issues.length > 0) {
    throw new Error(`Verdict does not follow prompt instructions: ${issues.join("; ")}`);
  }

  return normalized;
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
          "User-Agent": "BloomBot/1.0 (+https://bloomcircle.vercel.app)",
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
        throw new AppError("We couldn't import that URL. Paste the job description to continue.", 422, "validation_error");
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

  if (!combined) throw new AppError("Provide a job URL or paste the job description.", 422, "validation_error");

  return {
    rawText: combined.slice(0, 32000),
    importStatus,
    source,
    fetchedUrl: jobUrl ?? null,
  };
}

// Capped at MAX_RESUMES_PER_REQUEST so a single request's prompt size (and
// OpenAI cost) stays bounded regardless of how many resumes a user has
// saved — most recently updated resumes win.
export async function getUserResumes(adminClient: any, userId: string): Promise<ResumeRow[]> {
  const { data, error } = await adminClient
    .from("resumes")
    .select("id,name,target_role,file_path,file_name,file_type,extracted_text,extracted_text_updated_at,is_active,notes")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(MAX_RESUMES_PER_REQUEST);
  if (error) throw new AppError("Couldn't load your resumes right now.", 500, "internal_error");
  return (data ?? []) as ResumeRow[];
}

// Best-effort only: a missing/unreadable profile should never block cover
// letter generation, so this returns null on any error instead of throwing.
export async function getProfileCareerGoal(adminClient: any, userId: string): Promise<string | null> {
  const { data, error } = await adminClient.from("profiles").select("career_goal").eq("id", userId).single();
  if (error || !data) return null;
  return (data.career_goal as string | null) ?? null;
}

// Best-effort, same as getProfileCareerGoal — a missing settings row (or a
// user who hasn't set these yet) must never block analysis. Unset fields
// come back null, which the prompt is instructed to treat as "not
// specified," never as an automatic rejection.
export async function getCandidatePreferences(adminClient: any, userId: string): Promise<CandidatePreferences> {
  const { data } = await adminClient
    .from("settings")
    .select("relocation_preference,travel_preference,work_arrangement_preference")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    relocationPreference: data?.relocation_preference ?? null,
    travelPreference: data?.travel_preference ?? null,
    workArrangementPreference: data?.work_arrangement_preference ?? null,
  };
}

export async function getJobForUser(adminClient: any, userId: string, jobId: string): Promise<JobRow> {
  const { data, error } = await adminClient
    .from("jobs")
    .select(
      "id,user_id,company,title,location,salary,work_arrangement,job_url,job_description,deadline,resume_id,ai_extracted_data,verdict,fit_score,verdict_source",
    )
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new AppError("Job not found.", 404, "not_found");
  return data as JobRow;
}

/** Logs request metadata (model, action, latency, outcome) without exposing private content. */
function logAiMeta(meta: {
  model: string;
  action: string;
  latencyMs: number;
  success: boolean;
  attempt: number;
  inputTokens?: number;
  outputTokens?: number;
}) {
  console.log(
    JSON.stringify({
      event: "ai_request",
      model: meta.model,
      action: meta.action,
      latency_ms: meta.latencyMs,
      success: meta.success,
      attempt: meta.attempt,
      input_tokens: meta.inputTokens ?? null,
      output_tokens: meta.outputTokens ?? null,
    }),
  );
}

async function createOpenAIResponse(
  client: ReturnType<typeof getOpenAIClient>,
  body: Record<string, unknown>,
  options: { timeoutMs?: number; action?: string } = {},
) {
  const { timeoutMs = ANALYSIS_TIMEOUT_MS, action = "openai_request" } = options;
  const model = typeof body.model === "string" ? body.model : "unknown";
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS[attempt - 1] ?? 2_000));
    }

    const start = Date.now();
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${client.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (fetchError) {
      // Network-level failure (timeout, DNS, etc.) — always retryable.
      logAiMeta({ model, action, latencyMs: Date.now() - start, success: false, attempt });
      lastError = fetchError;
      continue;
    }

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      // Never forward the raw upstream error body to the browser — it can
      // contain implementation details. Log server-side only.
      console.error("OpenAI request failed", response.status, errorText || response.statusText);
      logAiMeta({ model, action, latencyMs, success: false, attempt });

      // 4xx errors (auth, quota, bad request) are not transient — do not retry.
      if (response.status < 500) {
        if (response.status === 429) {
          throw new AppError("AI quota reached. Please try again later.", 429, "rate_limited");
        }
        throw new AppError("The AI service is temporarily unavailable. Please try again in a moment.", 502, "upstream_error");
      }

      lastError = new AppError("The AI service is temporarily unavailable. Please try again in a moment.", 502, "upstream_error");
      continue;
    }

    const json = await response.json();
    const inputTokens = json?.usage?.input_tokens as number | undefined;
    const outputTokens = json?.usage?.output_tokens as number | undefined;
    logAiMeta({ model, action, latencyMs, success: true, attempt, inputTokens, outputTokens });
    return json;
  }

  throw lastError ?? new AppError("The AI service is temporarily unavailable. Please try again in a moment.", 502, "upstream_error");
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
  if (error || !signed?.signedUrl) throw new AppError(`Couldn't access ${resume.name} for analysis.`, 500, "internal_error");

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
  }, { timeoutMs: EXTRACTION_TIMEOUT_MS, action: "extract_resume_text" });

  const extractedText = normalizeWhitespace(extractResponseText(response)).slice(0, 24000);
  if (!extractedText) return null;

  const { error: updateError } = await adminClient
    .from("resumes")
    .update({
      extracted_text: extractedText,
      extracted_text_updated_at: new Date().toISOString(),
    })
    .eq("id", resume.id);
  if (updateError) throw new AppError("Couldn't cache extracted resume text.", 500, "internal_error");

  return extractedText;
}

const dealBreakerJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "status"],
  properties: {
    label: { type: "string" },
    status: { type: "string", enum: ["confirmed", "possible", "insufficient_information"] },
  },
} as const;

const logisticsConsiderationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "detail", "preferenceMatch"],
  properties: {
    label: { type: "string" },
    detail: { type: "string" },
    preferenceMatch: { type: "string", enum: ["aligned", "conflict", "unspecified"] },
  },
} as const;

const jobExtractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "company",
    "jobTitle",
    "location",
    "salary",
    "employmentType",
    "workArrangement",
    "requiredQualifications",
    "preferredQualifications",
    "requiredSkills",
    "preferredSkills",
    "responsibilities",
    "educationRequirements",
    "experienceRequirements",
    "certifications",
    "dealBreakers",
    "logisticsConsiderations",
    "applicationDeadline",
    "rawJobText",
  ],
  properties: {
    company: { type: ["string", "null"] },
    jobTitle: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    salary: { type: ["string", "null"] },
    employmentType: { type: ["string", "null"] },
    workArrangement: { type: ["string", "null"], enum: ["remote", "hybrid", "onsite", null] },
    requiredQualifications: { type: "array", items: { type: "string" } },
    preferredQualifications: { type: "array", items: { type: "string" } },
    requiredSkills: { type: "array", items: { type: "string" } },
    preferredSkills: { type: "array", items: { type: "string" } },
    responsibilities: { type: "array", items: { type: "string" } },
    educationRequirements: { type: "array", items: { type: "string" } },
    experienceRequirements: { type: "array", items: { type: "string" } },
    certifications: { type: "array", items: { type: "string" } },
    dealBreakers: { type: "array", items: dealBreakerJsonSchema },
    logisticsConsiderations: { type: "array", items: logisticsConsiderationJsonSchema },
    applicationDeadline: { type: ["string", "null"] },
    rawJobText: { type: "string" },
  },
} as const;

const analysisResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "opportunityAssessment",
    "candidateFit",
    "applicationRecommendation",
    "verdict",
    "nextStep",
  ],
  properties: {
    opportunityAssessment: { type: "string", enum: ["promising", "neutral", "risky", "ineligible"] },
    candidateFit: {
      type: "object",
      additionalProperties: false,
      required: [
        "fitScore",
        "confidence",
        "explanation",
        "strongMatches",
        "transferableStrengths",
        "criticalGaps",
        "preferredGaps",
        "unknowns",
      ],
      properties: {
        fitScore: { type: ["number", "null"], minimum: 0, maximum: 10 },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        explanation: { type: "string" },
        strongMatches: { type: "array", items: { type: "string" } },
        transferableStrengths: { type: "array", items: { type: "string" } },
        criticalGaps: { type: "array", items: { type: "string" } },
        preferredGaps: { type: "array", items: { type: "string" } },
        unknowns: { type: "array", items: { type: "string" } },
      },
    },
    applicationRecommendation: { type: "string", enum: ["apply_now", "tailor_first", "consider", "skip", "upload_resume_first"] },
    // Tighter than the DB/zod verdict enum on purpose: excellent_match,
    // stretch_opportunity, and high_risk stay valid for old rows and manual
    // selection (see schemas.ts), but the model itself now only chooses
    // among these five — see VERDICT RULES in careerCoach.ts.
    verdict: {
      type: "string",
      enum: ["strong_match", "worth_applying", "consider", "not_recommended", "not_yet_assessed"],
    },
    nextStep: { type: "string" },
  },
} as const;

const resumeRankingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["resumeId", "resumeName", "compatibilityScore", "strengths", "gaps", "recommendationReason"],
  properties: {
    resumeId: { type: "string" },
    resumeName: { type: "string" },
    compatibilityScore: { type: "integer", minimum: 0, maximum: 100 },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    recommendationReason: { type: "string" },
  },
} as const;

const resumeSuggestionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "suggestion", "reason"],
  properties: {
    type: { type: "string", enum: ["safe_wording", "reorder", "confirm_with_user", "genuine_gap"] },
    suggestion: { type: "string" },
    reason: { type: "string" },
  },
} as const;

// What we ask the model for. importStatus/source/fetchedUrl/promptVersion
// are NOT requested here — those are computed by us (from jobSource and
// CAREER_COACH_PROMPT_VERSION) and merged in after parsing, not asked of
// the model.
const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["jobExtraction", "analysis", "resumeRanking", "recommendedResumeId", "resumeSuggestions"],
  properties: {
    jobExtraction: jobExtractionJsonSchema,
    analysis: analysisResultJsonSchema,
    resumeRanking: { type: "array", items: resumeRankingJsonSchema },
    recommendedResumeId: { type: ["string", "null"] },
    resumeSuggestions: { type: "array", items: resumeSuggestionJsonSchema },
  },
} as const;

export async function analyzeJobAndResumes(
  client: ReturnType<typeof getOpenAIClient>,
  jobSource: { rawText: string; importStatus: "success" | "manual_fallback"; source: "url" | "manual" | "url_plus_manual"; fetchedUrl: string | null },
  resumes: Array<{ id: string; name: string; target_role: string | null; extracted_text: string }>,
  candidateEvidence: CandidateEvidenceContext,
  candidatePreferences: CandidatePreferences,
) {
  const resumePayload = resumes.map((resume) => ({
    resume_id: resume.id,
    resume_name: resume.name,
    target_role: resume.target_role,
    extracted_text: resume.extracted_text.slice(0, 12000),
  }));

  const systemInput = [
    {
      role: "developer",
      content: [{ type: "input_text", text: buildAnalysisPrompt() }],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: JSON.stringify(
            {
              job_source: jobSource,
              candidate_evidence: {
                resume_evidence_available: candidateEvidence.hasResumeEvidence,
                profile_evidence_available: candidateEvidence.hasProfileEvidence,
              },
              // Null in any of these three means the candidate hasn't said
              // — see CANDIDATE PREFERENCES in the prompt: unspecified must
              // be treated as "flag it as a consideration," never a
              // rejection. Only an explicit stated preference (e.g.
              // remote_only, not_open) may justify a "conflict" match.
              candidate_preferences: {
                relocation: candidatePreferences.relocationPreference,
                travel: candidatePreferences.travelPreference,
                work_arrangement: candidatePreferences.workArrangementPreference,
              },
              resumes: resumePayload,
            },
            null,
            2,
          ),
        },
      ],
    },
  ];

  const modelParams = {
    model: ANALYSIS_MODEL,
    reasoning: { effort: "medium" },
    text: {
      format: {
        type: "json_schema",
        name: "bloom_career_coach_analysis",
        strict: true,
        schema: analysisSchema,
      },
    },
  };

  const response = await createOpenAIResponse(
    client,
    { ...modelParams, input: systemInput },
    { timeoutMs: ANALYSIS_TIMEOUT_MS, action: "analyze_job" },
  );

  const rawText = extractResponseText(response);

  function mergeWithMeta(parsed: unknown) {
    const p = parsed as Record<string, unknown>;
    const response = analysisResponseSchema.parse({
      ...p,
      importStatus: jobSource.importStatus,
      source: jobSource.source,
      fetchedUrl: jobSource.fetchedUrl,
      promptVersion: CAREER_COACH_PROMPT_VERSION,
    });
    return normalizeAndValidateAnalysis(response, candidateEvidence);
  }

  try {
    return mergeWithMeta(JSON.parse(rawText));
  } catch (firstError) {
    // Log the validation failure without including résumé or job content.
    const errorSummary =
      firstError instanceof ZodError
        ? firstError.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : firstError instanceof Error
        ? firstError.message
        : "Invalid JSON or unexpected structure";
    console.error("Analysis validation failed on first attempt:", errorSummary);

    // Controlled repair: re-send the conversation with the bad output and a
    // targeted correction instruction. The repair message never includes
    // résumé text — only the model's own prior output and what was wrong.
    const repairInput = [
      ...systemInput,
      {
        role: "assistant",
        content: [{ type: "output_text", text: rawText }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `The previous response failed schema validation. Issues: ${errorSummary}. Return a corrected JSON object that fixes only the invalid fields while keeping all valid data unchanged.`,
          },
        ],
      },
    ];

    const repairResponse = await createOpenAIResponse(
      client,
      { ...modelParams, input: repairInput },
      { timeoutMs: ANALYSIS_TIMEOUT_MS, action: "analyze_job_repair" },
    );

    // If repair also fails, the ZodError propagates — errorResponse handles it
    // as a validation_error and never saves malformed output.
    return mergeWithMeta(JSON.parse(extractResponseText(repairResponse)));
  }
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
        name: "bloom_cover_letter",
        strict: true,
        schema: coverLetterSchema,
      },
    },
    input: [
      {
        role: "developer",
        content: [{ type: "input_text", text: buildCoverLetterPrompt() }],
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
  }, { timeoutMs: COVER_LETTER_TIMEOUT_MS, action: "generate_cover_letter" });

  return coverLetterResponseSchema.parse(JSON.parse(extractResponseText(response)));
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  if (error instanceof ZodError) {
    return { status: 400, body: { error: "Invalid request or model response.", code: "validation_error", details: error.flatten() } };
  }
  console.error(error);
  return { status: 500, body: { error: "Something went wrong while running the AI workflow.", code: "internal_error" } };
}
