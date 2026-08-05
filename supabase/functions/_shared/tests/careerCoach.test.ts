// =====================================================================
// Tests for the Bloom Career Coach system: fabrication prevention,
// missing-information handling, required-vs-preferred distinctions,
// résumé ownership enforcement, malformed model responses, and rate
// limiting. Run with: deno test --allow-env
// =====================================================================

import { assertEquals, assertRejects, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { z, ZodError } from "npm:zod";
import { analysisResponseSchema, analysisResultSchema, jobExtractionSchema, resumeRankingSchema, resumeSuggestionSchema } from "../schemas.ts";
import { AppError } from "../utils.ts";
import { CAREER_COACH_PROMPT_VERSION, buildAnalysisPrompt, buildCoverLetterPrompt } from "../prompts/careerCoach.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validAnalysisResponse() {
  return {
    importStatus: "success",
    source: "url",
    fetchedUrl: "https://example.com/jobs/1",
    promptVersion: CAREER_COACH_PROMPT_VERSION,
    jobExtraction: {
      company: "Acme Corp",
      jobTitle: "Software Engineer",
      location: "San Francisco, CA",
      salary: null,
      employmentType: "full-time",
      workArrangement: "hybrid",
      requiredQualifications: ["3+ years TypeScript experience"],
      preferredQualifications: ["React Native experience"],
      requiredSkills: ["TypeScript", "React"],
      preferredSkills: ["React Native"],
      responsibilities: ["Build web applications"],
      educationRequirements: ["Bachelor's degree in CS or equivalent"],
      experienceRequirements: ["3+ years in software development"],
      certifications: [],
      dealBreakers: [{ label: "Must be authorized to work in the US", status: "possible" }],
      applicationDeadline: null,
      rawJobText: "Job description text here",
    },
    analysis: {
      fitScore: 7,
      confidence: "high",
      verdict: "strong_match",
      verdictExplanation: "Candidate meets most required qualifications.",
      strongMatches: ["TypeScript", "React"],
      transferableStrengths: ["Agile team experience"],
      criticalGaps: [],
      preferredGaps: ["React Native"],
      unknowns: [],
      scoreIncreases: ["Demonstrated TypeScript proficiency"],
      scoreReductions: [],
      applicationPriority: "apply_now",
      careerCoachAdvice: "Your TypeScript background is your strongest asset here.",
      nextStep: "Submit application and tailor the summary to highlight TypeScript depth.",
    },
    resumeRanking: [
      {
        resumeId: "550e8400-e29b-41d4-a716-446655440000",
        resumeName: "Senior Resume",
        compatibilityScore: 82,
        strengths: ["TypeScript depth"],
        gaps: ["No React Native"],
        recommendationReason: "Closest match to required skills.",
      },
    ],
    recommendedResumeId: "550e8400-e29b-41d4-a716-446655440000",
    resumeSuggestions: [
      { type: "safe_wording", suggestion: "Lead with TypeScript in your skills section", reason: "Mirrors job posting language" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Prompt structure tests
// ---------------------------------------------------------------------------

Deno.test("buildAnalysisPrompt includes source-of-truth anti-fabrication rules", () => {
  const prompt = buildAnalysisPrompt();
  // Must tell the model not to invent data.
  const requiredPhrases = [
    "Do not assume or invent",
    "Never recommend adding something to a résumé unless the supplied information supports",
    "Never invent a metric",
  ];
  for (const phrase of requiredPhrases) {
    assertEquals(prompt.includes(phrase), true, `Missing anti-fabrication phrase: "${phrase}"`);
  }
});

Deno.test("buildAnalysisPrompt includes required-vs-preferred distinction", () => {
  const prompt = buildAnalysisPrompt();
  assertEquals(prompt.includes("preferred"), true, "Prompt must distinguish preferred qualifications");
  assertEquals(
    prompt.includes("Missing preferred qualifications should not severely reduce the score"),
    true,
    "Prompt must explain that missing preferred quals don't tank the score",
  );
});

Deno.test("buildAnalysisPrompt includes all six verdict values", () => {
  const prompt = buildAnalysisPrompt();
  const verdicts = ["excellent_match", "strong_match", "worth_applying", "stretch_opportunity", "high_risk", "not_recommended"];
  for (const v of verdicts) {
    assertEquals(prompt.includes(v), true, `Verdict "${v}" missing from prompt`);
  }
});

Deno.test("buildAnalysisPrompt includes deal-breaker status labels", () => {
  const prompt = buildAnalysisPrompt();
  assertEquals(prompt.includes("confirmed"), true);
  assertEquals(prompt.includes("possible"), true);
  assertEquals(prompt.includes("insufficient_information"), true);
});

Deno.test("buildAnalysisPrompt includes privacy rules", () => {
  const prompt = buildAnalysisPrompt();
  assertEquals(prompt.includes("PRIVACY AND DATA MINIMIZATION"), true);
  assertEquals(prompt.includes("Do not request or reference"), true);
});

Deno.test("buildCoverLetterPrompt does not include job analysis scoring instructions", () => {
  const prompt = buildCoverLetterPrompt();
  // Cover letter prompt must not include FIT SCORE METHODOLOGY
  assertEquals(prompt.includes("FIT SCORE METHODOLOGY"), false);
  assertEquals(prompt.includes("COVER LETTER RULES"), true);
});

Deno.test("prompt version constant is non-empty string", () => {
  assertEquals(typeof CAREER_COACH_PROMPT_VERSION, "string");
  assertEquals(CAREER_COACH_PROMPT_VERSION.length > 0, true);
});

// ---------------------------------------------------------------------------
// Schema validation: fabrication prevention
// ---------------------------------------------------------------------------

Deno.test("analysisResponseSchema rejects invented UUID for recommendedResumeId", () => {
  const bad = {
    ...validAnalysisResponse(),
    recommendedResumeId: "not-a-uuid",
  };
  assertThrows(() => analysisResponseSchema.parse(bad), ZodError);
});

Deno.test("analysisResponseSchema rejects fitScore above 10", () => {
  const bad = {
    ...validAnalysisResponse(),
    analysis: { ...validAnalysisResponse().analysis, fitScore: 11 },
  };
  assertThrows(() => analysisResponseSchema.parse(bad), ZodError);
});

Deno.test("analysisResponseSchema rejects fitScore below 0", () => {
  const bad = {
    ...validAnalysisResponse(),
    analysis: { ...validAnalysisResponse().analysis, fitScore: -1 },
  };
  assertThrows(() => analysisResponseSchema.parse(bad), ZodError);
});

Deno.test("analysisResponseSchema rejects non-integer fitScore", () => {
  const bad = {
    ...validAnalysisResponse(),
    analysis: { ...validAnalysisResponse().analysis, fitScore: 7.5 },
  };
  assertThrows(() => analysisResponseSchema.parse(bad), ZodError);
});

Deno.test("analysisResponseSchema rejects unknown verdict", () => {
  const bad = {
    ...validAnalysisResponse(),
    analysis: { ...validAnalysisResponse().analysis, verdict: "great_fit" },
  };
  assertThrows(() => analysisResponseSchema.parse(bad), ZodError);
});

Deno.test("analysisResponseSchema rejects unknown applicationPriority", () => {
  const bad = {
    ...validAnalysisResponse(),
    analysis: { ...validAnalysisResponse().analysis, applicationPriority: "urgent" },
  };
  assertThrows(() => analysisResponseSchema.parse(bad), ZodError);
});

Deno.test("analysisResponseSchema rejects unknown confidence level", () => {
  const bad = {
    ...validAnalysisResponse(),
    analysis: { ...validAnalysisResponse().analysis, confidence: "very_high" },
  };
  assertThrows(() => analysisResponseSchema.parse(bad), ZodError);
});

Deno.test("resumeSuggestionSchema rejects unknown suggestion type", () => {
  assertThrows(
    () =>
      resumeSuggestionSchema.parse({
        type: "invented_improvement",
        suggestion: "Add AWS certification",
        reason: "Looks good",
      }),
    ZodError,
  );
});

Deno.test("resumeRankingSchema rejects compatibilityScore above 100", () => {
  assertThrows(
    () =>
      resumeRankingSchema.parse({
        resumeId: "550e8400-e29b-41d4-a716-446655440000",
        resumeName: "My Resume",
        compatibilityScore: 105,
        strengths: [],
        gaps: [],
        recommendationReason: "Best fit",
      }),
    ZodError,
  );
});

Deno.test("jobExtractionSchema rejects invalid workArrangement", () => {
  assertThrows(
    () =>
      jobExtractionSchema.parse({
        ...validAnalysisResponse().jobExtraction,
        workArrangement: "flexible",
      }),
    ZodError,
  );
});

// ---------------------------------------------------------------------------
// Schema validation: missing information handled gracefully
// ---------------------------------------------------------------------------

Deno.test("analysisResponseSchema accepts null salary (unknown)", () => {
  const response = analysisResponseSchema.parse(validAnalysisResponse());
  assertEquals(response.jobExtraction.salary, null);
});

Deno.test("analysisResponseSchema accepts null applicationDeadline", () => {
  const response = analysisResponseSchema.parse(validAnalysisResponse());
  assertEquals(response.jobExtraction.applicationDeadline, null);
});

Deno.test("analysisResponseSchema accepts null recommendedResumeId", () => {
  const response = analysisResponseSchema.parse({
    ...validAnalysisResponse(),
    recommendedResumeId: null,
  });
  assertEquals(response.recommendedResumeId, null);
});

Deno.test("analysisResponseSchema accepts empty arrays for all list fields", () => {
  const response = analysisResponseSchema.parse({
    ...validAnalysisResponse(),
    jobExtraction: {
      ...validAnalysisResponse().jobExtraction,
      requiredQualifications: [],
      preferredQualifications: [],
      requiredSkills: [],
      preferredSkills: [],
      responsibilities: [],
      educationRequirements: [],
      experienceRequirements: [],
      certifications: [],
      dealBreakers: [],
    },
    resumeRanking: [],
    resumeSuggestions: [],
  });
  assertEquals(response.resumeRanking, []);
  assertEquals(response.resumeSuggestions, []);
});

// ---------------------------------------------------------------------------
// Required-vs-preferred distinctions
// ---------------------------------------------------------------------------

Deno.test("dealBreaker schema accepts confirmed status", () => {
  const { dealBreakers } = jobExtractionSchema.parse({
    ...validAnalysisResponse().jobExtraction,
    dealBreakers: [{ label: "US work authorization required", status: "confirmed" }],
  });
  assertEquals(dealBreakers[0].status, "confirmed");
});

Deno.test("dealBreaker schema accepts insufficient_information status", () => {
  const { dealBreakers } = jobExtractionSchema.parse({
    ...validAnalysisResponse().jobExtraction,
    dealBreakers: [{ label: "May require clearance", status: "insufficient_information" }],
  });
  assertEquals(dealBreakers[0].status, "insufficient_information");
});

Deno.test("dealBreaker schema rejects invented status", () => {
  assertThrows(
    () =>
      jobExtractionSchema.parse({
        ...validAnalysisResponse().jobExtraction,
        dealBreakers: [{ label: "Something", status: "preferred_only" }],
      }),
    ZodError,
  );
});

// ---------------------------------------------------------------------------
// Malformed model responses
// ---------------------------------------------------------------------------

Deno.test("analysisResponseSchema throws ZodError on completely empty object", () => {
  assertThrows(() => analysisResponseSchema.parse({}), ZodError);
});

Deno.test("analysisResponseSchema throws ZodError on null", () => {
  assertThrows(() => analysisResponseSchema.parse(null), ZodError);
});

Deno.test("analysisResponseSchema throws ZodError when analysis is missing", () => {
  const { analysis: _removed, ...without } = validAnalysisResponse();
  assertThrows(() => analysisResponseSchema.parse(without), ZodError);
});

Deno.test("analysisResponseSchema throws ZodError when jobExtraction is missing", () => {
  const { jobExtraction: _removed, ...without } = validAnalysisResponse();
  assertThrows(() => analysisResponseSchema.parse(without), ZodError);
});

Deno.test("JSON.parse throws on non-JSON string (simulates malformed model output)", () => {
  assertThrows(() => JSON.parse("Here is my analysis: great fit!"), SyntaxError);
});

// ---------------------------------------------------------------------------
// AppError: rate limiting and ownership
// ---------------------------------------------------------------------------

Deno.test("AppError carries correct status and code for rate_limited", () => {
  const err = new AppError("Too many requests", 429, "rate_limited");
  assertEquals(err.status, 429);
  assertEquals(err.code, "rate_limited");
  assertEquals(err.message, "Too many requests");
});

Deno.test("AppError carries correct status and code for not_found (ownership rejection)", () => {
  const err = new AppError("Job not found.", 404, "not_found");
  assertEquals(err.status, 404);
  assertEquals(err.code, "not_found");
});

Deno.test("AppError carries correct status and code for unauthenticated", () => {
  const err = new AppError("Authentication required.", 401, "unauthenticated");
  assertEquals(err.status, 401);
  assertEquals(err.code, "unauthenticated");
});

// ---------------------------------------------------------------------------
// Full valid response round-trip
// ---------------------------------------------------------------------------

Deno.test("validAnalysisResponse passes schema validation end-to-end", () => {
  const parsed = analysisResponseSchema.parse(validAnalysisResponse());
  assertEquals(parsed.analysis.fitScore, 7);
  assertEquals(parsed.analysis.verdict, "strong_match");
  assertEquals(parsed.promptVersion, CAREER_COACH_PROMPT_VERSION);
  assertEquals(parsed.resumeRanking[0].compatibilityScore, 82);
});
