// =====================================================================
// Tests for the Bloom Career Coach system: fabrication prevention,
// missing-information handling, required-vs-preferred distinctions,
// résumé ownership enforcement, malformed model responses, rate
// limiting, and rubric-score calculation.
// Run with: deno test --allow-env
// =====================================================================

import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ZodError } from "npm:zod";
import { analysisResponseSchema, jobExtractionSchema, resumeRankingSchema, resumeSuggestionSchema } from "../schemas.ts";
import { AppError } from "../utils.ts";
import { CAREER_COACH_PROMPT_VERSION, buildAnalysisPrompt, buildCoverLetterPrompt } from "../prompts/careerCoach.ts";
import {
  buildScoredRubric,
  calculateFitScore,
  RUBRIC_VERSION,
  SCORING_CATEGORIES,
  SCORING_RUBRIC,
  type CategoryInput,
  type ScoringCategory,
} from "../rubric.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function allCategoryInputs(rawScore: number): Record<ScoringCategory, CategoryInput> {
  return Object.fromEntries(
    SCORING_CATEGORIES.map((cat) => [cat, { rawScore, evidence: ["example"], notes: "test" }]),
  ) as Record<ScoringCategory, CategoryInput>;
}

function validCategoryScores() {
  return [
    { category: "required_qualifications",  label: "Required Qualifications",                           rawScore: 8, weight: 0.30, weightedContribution: 2.40, evidence: ["TypeScript"], notes: "Strong" },
    { category: "relevant_experience",      label: "Relevant Experience & Responsibilities",            rawScore: 7, weight: 0.20, weightedContribution: 1.40, evidence: ["5 years SWE"], notes: "Good" },
    { category: "relevant_skills",          label: "Relevant Skills & Tools",                           rawScore: 8, weight: 0.15, weightedContribution: 1.20, evidence: ["React"], notes: "Strong" },
    { category: "education_certifications", label: "Education, Certifications & Licenses",              rawScore: 6, weight: 0.10, weightedContribution: 0.60, evidence: ["BS CS"], notes: "Meets" },
    { category: "projects_portfolio",       label: "Relevant Projects & Portfolio Evidence",            rawScore: 7, weight: 0.10, weightedContribution: 0.70, evidence: ["GitHub"], notes: "Portfolio" },
    { category: "preferred_qualifications", label: "Preferred Qualifications",                          rawScore: 4, weight: 0.05, weightedContribution: 0.20, evidence: [], notes: "Missing RN" },
    { category: "seniority_alignment",      label: "Seniority & Years-of-Experience Alignment",        rawScore: 8, weight: 0.05, weightedContribution: 0.40, evidence: ["Senior"], notes: "Good" },
    { category: "location_logistics",       label: "Location, Travel, Arrangement & Work Authorization", rawScore: 10, weight: 0.05, weightedContribution: 0.50, evidence: ["Remote"], notes: "OK" },
  ];
}

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
      fitScore: 7.4,
      rubricVersion: RUBRIC_VERSION,
      categoryScores: validCategoryScores(),
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
// Rubric: weight integrity
// ---------------------------------------------------------------------------

Deno.test("rubric weights sum to exactly 1.0", () => {
  const total = Object.values(SCORING_RUBRIC).reduce((s, c) => s + c.weight, 0);
  assertEquals(Math.abs(total - 1.0) < 1e-9, true, `Weights sum to ${total}, expected 1.0`);
});

Deno.test("rubric has exactly 8 categories", () => {
  assertEquals(SCORING_CATEGORIES.length, 8);
});

Deno.test("RUBRIC_VERSION is a non-empty string", () => {
  assertEquals(typeof RUBRIC_VERSION, "string");
  assertEquals(RUBRIC_VERSION.length > 0, true);
});

// ---------------------------------------------------------------------------
// calculateFitScore: deterministic weighted aggregation
// ---------------------------------------------------------------------------

Deno.test("calculateFitScore returns 0.0 when all rawScores are 0", () => {
  assertEquals(calculateFitScore(allCategoryInputs(0)), 0.0);
});

Deno.test("calculateFitScore returns 10.0 when all rawScores are 10", () => {
  assertEquals(calculateFitScore(allCategoryInputs(10)), 10.0);
});

Deno.test("calculateFitScore clamps rawScore above 10 to 10", () => {
  const inputs = allCategoryInputs(10);
  inputs.required_qualifications = { rawScore: 15, evidence: [], notes: "" };
  assertEquals(calculateFitScore(inputs), 10.0);
});

Deno.test("calculateFitScore clamps rawScore below 0 to 0", () => {
  const inputs = allCategoryInputs(0);
  inputs.required_qualifications = { rawScore: -5, evidence: [], notes: "" };
  assertEquals(calculateFitScore(inputs), 0.0);
});

Deno.test("calculateFitScore is deterministic — same inputs produce same output", () => {
  const inputs = allCategoryInputs(7);
  assertEquals(calculateFitScore(inputs), calculateFitScore(inputs));
});

Deno.test("calculateFitScore applies required_qualifications weight of 30%", () => {
  // Only required_qualifications = 10; everything else = 0.
  const inputs = allCategoryInputs(0);
  inputs.required_qualifications = { rawScore: 10, evidence: [], notes: "" };
  assertEquals(calculateFitScore(inputs), 3.0); // 10 * 0.30
});

Deno.test("calculateFitScore required_qualifications boost > preferred_qualifications boost", () => {
  const base = allCategoryInputs(5);
  const highRequired  = { ...allCategoryInputs(5), required_qualifications:  { rawScore: 10, evidence: [], notes: "" } };
  const highPreferred = { ...allCategoryInputs(5), preferred_qualifications: { rawScore: 10, evidence: [], notes: "" } };
  assertEquals(calculateFitScore(highRequired) > calculateFitScore(highPreferred), true);
});

Deno.test("calculateFitScore rounds to one decimal place", () => {
  const score = calculateFitScore(allCategoryInputs(7));
  const decimals = String(score).includes(".") ? String(score).split(".")[1].length : 0;
  assertEquals(decimals <= 1, true);
});

// ---------------------------------------------------------------------------
// buildScoredRubric: enriched output
// ---------------------------------------------------------------------------

Deno.test("buildScoredRubric returns all 8 categories in order", () => {
  const result = buildScoredRubric(allCategoryInputs(5));
  assertEquals(result.categories.length, 8);
  assertEquals(result.categories.map((c) => c.category), SCORING_CATEGORIES);
});

Deno.test("buildScoredRubric weightedContribution equals rawScore * weight", () => {
  const result = buildScoredRubric(allCategoryInputs(8));
  for (const cat of result.categories) {
    assertEquals(cat.weightedContribution, Math.round(cat.rawScore * cat.weight * 100) / 100);
  }
});

Deno.test("buildScoredRubric fitScore matches calculateFitScore", () => {
  const inputs = allCategoryInputs(6);
  assertEquals(buildScoredRubric(inputs).fitScore, calculateFitScore(inputs));
});

Deno.test("buildScoredRubric stamps rubricVersion", () => {
  assertEquals(buildScoredRubric(allCategoryInputs(5)).rubricVersion, RUBRIC_VERSION);
});

Deno.test("buildScoredRubric preserves evidence and notes", () => {
  const inputs = allCategoryInputs(7);
  inputs.required_qualifications = { rawScore: 7, evidence: ["3 years TypeScript"], notes: "Direct match" };
  const cat = buildScoredRubric(inputs).categories.find((c) => c.category === "required_qualifications")!;
  assertEquals(cat.evidence, ["3 years TypeScript"]);
  assertEquals(cat.notes, "Direct match");
});

// ---------------------------------------------------------------------------
// Prompt structure tests
// ---------------------------------------------------------------------------

Deno.test("buildAnalysisPrompt instructs model NOT to provide a single fitScore", () => {
  assertEquals(buildAnalysisPrompt().includes("Do NOT provide a single overall fitScore"), true);
});

Deno.test("buildAnalysisPrompt lists all 8 scoring category keys", () => {
  const prompt = buildAnalysisPrompt();
  for (const cat of SCORING_CATEGORIES) {
    assertEquals(prompt.includes(cat), true, `Category "${cat}" missing from prompt`);
  }
});

Deno.test("buildAnalysisPrompt includes anti-fabrication rules", () => {
  const prompt = buildAnalysisPrompt();
  for (const phrase of ["Do not assume or invent", "Never invent a metric"]) {
    assertEquals(prompt.includes(phrase), true, `Missing phrase: "${phrase}"`);
  }
});

Deno.test("buildAnalysisPrompt includes required-vs-preferred distinction", () => {
  assertEquals(buildAnalysisPrompt().includes("Missing preferred qualifications"), true);
});

Deno.test("buildAnalysisPrompt includes all six verdict values", () => {
  const prompt = buildAnalysisPrompt();
  for (const v of ["excellent_match", "strong_match", "worth_applying", "stretch_opportunity", "high_risk", "not_recommended"]) {
    assertEquals(prompt.includes(v), true, `Verdict "${v}" missing from prompt`);
  }
});

Deno.test("buildAnalysisPrompt includes privacy rules", () => {
  assertEquals(buildAnalysisPrompt().includes("PRIVACY AND DATA MINIMIZATION"), true);
});

Deno.test("buildCoverLetterPrompt excludes FIT SCORE METHODOLOGY", () => {
  assertEquals(buildCoverLetterPrompt().includes("FIT SCORE METHODOLOGY"), false);
  assertEquals(buildCoverLetterPrompt().includes("COVER LETTER RULES"), true);
});

Deno.test("CAREER_COACH_PROMPT_VERSION is non-empty", () => {
  assertEquals(typeof CAREER_COACH_PROMPT_VERSION, "string");
  assertEquals(CAREER_COACH_PROMPT_VERSION.length > 0, true);
});

// ---------------------------------------------------------------------------
// Schema validation: fabrication prevention
// ---------------------------------------------------------------------------

Deno.test("analysisResponseSchema rejects invented UUID for recommendedResumeId", () => {
  assertThrows(() => analysisResponseSchema.parse({ ...validAnalysisResponse(), recommendedResumeId: "not-a-uuid" }), ZodError);
});

Deno.test("analysisResponseSchema rejects fitScore above 10", () => {
  assertThrows(
    () => analysisResponseSchema.parse({ ...validAnalysisResponse(), analysis: { ...validAnalysisResponse().analysis, fitScore: 11 } }),
    ZodError,
  );
});

Deno.test("analysisResponseSchema rejects fitScore below 0", () => {
  assertThrows(
    () => analysisResponseSchema.parse({ ...validAnalysisResponse(), analysis: { ...validAnalysisResponse().analysis, fitScore: -1 } }),
    ZodError,
  );
});

Deno.test("analysisResponseSchema accepts float fitScore (app-calculated)", () => {
  const r = analysisResponseSchema.parse({ ...validAnalysisResponse(), analysis: { ...validAnalysisResponse().analysis, fitScore: 7.5 } });
  assertEquals(r.analysis.fitScore, 7.5);
});

Deno.test("analysisResponseSchema rejects unknown verdict", () => {
  assertThrows(
    () => analysisResponseSchema.parse({ ...validAnalysisResponse(), analysis: { ...validAnalysisResponse().analysis, verdict: "great_fit" } }),
    ZodError,
  );
});

Deno.test("analysisResponseSchema rejects unknown applicationPriority", () => {
  assertThrows(
    () => analysisResponseSchema.parse({ ...validAnalysisResponse(), analysis: { ...validAnalysisResponse().analysis, applicationPriority: "urgent" } }),
    ZodError,
  );
});

Deno.test("categoryScoreSchema rejects rawScore above 10", () => {
  assertThrows(
    () => analysisResponseSchema.parse({
      ...validAnalysisResponse(),
      analysis: { ...validAnalysisResponse().analysis, categoryScores: validCategoryScores().map((c) => ({ ...c, rawScore: 11 })) },
    }),
    ZodError,
  );
});

Deno.test("resumeSuggestionSchema rejects unknown suggestion type", () => {
  assertThrows(
    () => resumeSuggestionSchema.parse({ type: "invented_improvement", suggestion: "Add certification", reason: "Looks good" }),
    ZodError,
  );
});

Deno.test("resumeRankingSchema rejects compatibilityScore above 100", () => {
  assertThrows(
    () => resumeRankingSchema.parse({ resumeId: "550e8400-e29b-41d4-a716-446655440000", resumeName: "CV", compatibilityScore: 105, strengths: [], gaps: [], recommendationReason: "" }),
    ZodError,
  );
});

// ---------------------------------------------------------------------------
// Schema validation: missing information handled gracefully
// ---------------------------------------------------------------------------

Deno.test("analysisResponseSchema accepts null salary", () => {
  assertEquals(analysisResponseSchema.parse(validAnalysisResponse()).jobExtraction.salary, null);
});

Deno.test("analysisResponseSchema accepts null recommendedResumeId", () => {
  assertEquals(analysisResponseSchema.parse({ ...validAnalysisResponse(), recommendedResumeId: null }).recommendedResumeId, null);
});

Deno.test("analysisResponseSchema accepts empty list fields", () => {
  const r = analysisResponseSchema.parse({
    ...validAnalysisResponse(),
    jobExtraction: { ...validAnalysisResponse().jobExtraction, requiredQualifications: [], requiredSkills: [], dealBreakers: [] },
    resumeRanking: [],
    resumeSuggestions: [],
  });
  assertEquals(r.resumeRanking, []);
});

// ---------------------------------------------------------------------------
// Required-vs-preferred distinctions
// ---------------------------------------------------------------------------

Deno.test("dealBreaker schema accepts all three valid statuses", () => {
  for (const status of ["confirmed", "possible", "insufficient_information"] as const) {
    const { dealBreakers } = jobExtractionSchema.parse({
      ...validAnalysisResponse().jobExtraction,
      dealBreakers: [{ label: "Test", status }],
    });
    assertEquals(dealBreakers[0].status, status);
  }
});

Deno.test("dealBreaker schema rejects invented status", () => {
  assertThrows(
    () => jobExtractionSchema.parse({ ...validAnalysisResponse().jobExtraction, dealBreakers: [{ label: "X", status: "preferred_only" }] }),
    ZodError,
  );
});

// ---------------------------------------------------------------------------
// Malformed model responses
// ---------------------------------------------------------------------------

Deno.test("analysisResponseSchema throws ZodError on empty object", () => {
  assertThrows(() => analysisResponseSchema.parse({}), ZodError);
});

Deno.test("analysisResponseSchema throws ZodError when analysis is missing", () => {
  const { analysis: _r, ...without } = validAnalysisResponse();
  assertThrows(() => analysisResponseSchema.parse(without), ZodError);
});

Deno.test("JSON.parse throws on non-JSON string", () => {
  assertThrows(() => JSON.parse("Here is my analysis: great fit!"), SyntaxError);
});

// ---------------------------------------------------------------------------
// AppError: rate limiting and ownership
// ---------------------------------------------------------------------------

Deno.test("AppError rate_limited: status 429", () => {
  const err = new AppError("Too many requests", 429, "rate_limited");
  assertEquals(err.status, 429);
  assertEquals(err.code, "rate_limited");
});

Deno.test("AppError not_found: status 404 (ownership rejection)", () => {
  const err = new AppError("Job not found.", 404, "not_found");
  assertEquals(err.status, 404);
  assertEquals(err.code, "not_found");
});

Deno.test("AppError unauthenticated: status 401", () => {
  const err = new AppError("Authentication required.", 401, "unauthenticated");
  assertEquals(err.status, 401);
  assertEquals(err.code, "unauthenticated");
});

// ---------------------------------------------------------------------------
// Full round-trip: schema + version stamps
// ---------------------------------------------------------------------------

Deno.test("validAnalysisResponse passes end-to-end schema validation", () => {
  const parsed = analysisResponseSchema.parse(validAnalysisResponse());
  assertEquals(parsed.analysis.fitScore, 7.4);
  assertEquals(parsed.analysis.verdict, "strong_match");
  assertEquals(parsed.analysis.rubricVersion, RUBRIC_VERSION);
  assertEquals(parsed.promptVersion, CAREER_COACH_PROMPT_VERSION);
  assertEquals(parsed.analysis.categoryScores.length, 8);
  assertEquals(parsed.resumeRanking[0].compatibilityScore, 82);
});
