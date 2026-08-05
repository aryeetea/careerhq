// =====================================================================
// Tests for the Bloom Career Coach system: prompt structure, schema
// validation, verdict guardrails, and malformed model responses.
// Run with: deno test --allow-env
//
// This file was previously stale relative to schemas.ts/utils.ts — it
// referenced a nonexistent assertVerdictFollowsInstructions export and a
// flat analysis shape (fitScore/verdictExplanation/scoreIncreases/
// applicationPriority/careerCoachAdvice at the top level) from an earlier
// contract iteration, while schemas.ts/utils.ts had already moved to the
// nested { opportunityAssessment, candidateFit, applicationRecommendation,
// verdict, nextStep } shape, with the real guard living in
// normalizeAndValidateAnalysis. `deno check` on this file is how that
// mismatch was caught — run it after any contract change here.
// =====================================================================

import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ZodError } from "npm:zod";
import { analysisResponseSchema, jobExtractionSchema, resumeRankingSchema, resumeSuggestionSchema, type AnalysisResponse } from "../schemas.ts";
import { AppError, normalizeAndValidateAnalysis, type CandidateEvidenceContext } from "../utils.ts";
import { CAREER_COACH_PROMPT_VERSION, buildAnalysisPrompt, buildCoverLetterPrompt } from "../prompts/careerCoach.ts";

const HAS_EVIDENCE: CandidateEvidenceContext = { hasResumeEvidence: true, hasProfileEvidence: true };

function validAnalysisResponse(): AnalysisResponse {
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
      opportunityAssessment: "promising",
      candidateFit: {
        fitScore: 7.4,
        confidence: "high",
        explanation: "Candidate meets most required qualifications, strongest evidence is direct TypeScript experience.",
        strongMatches: ["TypeScript", "React"],
        transferableStrengths: ["Agile team experience"],
        criticalGaps: [],
        preferredGaps: ["React Native"],
        unknowns: [],
      },
      applicationRecommendation: "apply_now",
      verdict: "strong_match",
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

Deno.test("buildAnalysisPrompt includes anti-fabrication rules", () => {
  const prompt = buildAnalysisPrompt();
  for (const phrase of ["Do not assume or invent", "Never invent a metric"]) {
    assertEquals(prompt.includes(phrase), true, `Missing phrase: "${phrase}"`);
  }
});

Deno.test("buildAnalysisPrompt includes required-vs-preferred distinction", () => {
  assertEquals(buildAnalysisPrompt().includes("Missing preferred qualifications"), true);
});

Deno.test("buildAnalysisPrompt includes fitScore guidance", () => {
  const prompt = buildAnalysisPrompt();
  assertEquals(prompt.includes("fitScore must be a number from 0.0 to 10.0"), true);
  assertEquals(prompt.includes("The score represents current alignment with available candidate evidence"), true);
});

Deno.test("buildAnalysisPrompt includes all seven verdict values", () => {
  const prompt = buildAnalysisPrompt();
  for (const v of ["excellent_match", "strong_match", "worth_applying", "stretch_opportunity", "high_risk", "not_recommended", "not_yet_assessed"]) {
    assertEquals(prompt.includes(v), true, `Verdict "${v}" missing from prompt`);
  }
});

Deno.test("buildAnalysisPrompt includes the explicit weighted rubric categories", () => {
  const prompt = buildAnalysisPrompt();
  for (const phrase of ["Required skills — 30%", "Relevant experience and responsibilities — 25%", "Career progression"]) {
    assertEquals(prompt.includes(phrase), true, `Missing phrase: "${phrase}"`);
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

Deno.test("analysisResponseSchema rejects invented UUID for recommendedResumeId", () => {
  assertThrows(() => analysisResponseSchema.parse({ ...validAnalysisResponse(), recommendedResumeId: "not-a-uuid" }), ZodError);
});

Deno.test("analysisResponseSchema rejects fitScore above 10", () => {
  const base = validAnalysisResponse();
  assertThrows(
    () => analysisResponseSchema.parse({ ...base, analysis: { ...base.analysis, candidateFit: { ...base.analysis.candidateFit, fitScore: 11 } } }),
    ZodError,
  );
});

Deno.test("analysisResponseSchema rejects fitScore below 0", () => {
  const base = validAnalysisResponse();
  assertThrows(
    () => analysisResponseSchema.parse({ ...base, analysis: { ...base.analysis, candidateFit: { ...base.analysis.candidateFit, fitScore: -1 } } }),
    ZodError,
  );
});

Deno.test("analysisResponseSchema accepts float fitScore", () => {
  const base = validAnalysisResponse();
  const r = analysisResponseSchema.parse({ ...base, analysis: { ...base.analysis, candidateFit: { ...base.analysis.candidateFit, fitScore: 7.5 } } });
  assertEquals(r.analysis.candidateFit.fitScore, 7.5);
});

Deno.test("analysisResponseSchema accepts null fitScore", () => {
  const base = validAnalysisResponse();
  const r = analysisResponseSchema.parse({ ...base, analysis: { ...base.analysis, candidateFit: { ...base.analysis.candidateFit, fitScore: null } } });
  assertEquals(r.analysis.candidateFit.fitScore, null);
});

Deno.test("analysisResponseSchema rejects unknown verdict", () => {
  const base = validAnalysisResponse();
  assertThrows(
    () => analysisResponseSchema.parse({ ...base, analysis: { ...base.analysis, verdict: "great_fit" } }),
    ZodError,
  );
});

Deno.test("analysisResponseSchema rejects unknown applicationRecommendation", () => {
  const base = validAnalysisResponse();
  assertThrows(
    () => analysisResponseSchema.parse({ ...base, analysis: { ...base.analysis, applicationRecommendation: "urgent" } }),
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

Deno.test("normalizeAndValidateAnalysis rejects excellent_match when critical gaps exist", () => {
  const base = validAnalysisResponse();
  assertThrows(
    () =>
      normalizeAndValidateAnalysis(
        {
          ...base,
          analysis: {
            ...base.analysis,
            verdict: "excellent_match",
            candidateFit: { ...base.analysis.candidateFit, criticalGaps: ["Missing required certification"] },
          },
        },
        HAS_EVIDENCE,
      ),
    Error,
  );
});

Deno.test("normalizeAndValidateAnalysis rejects positive verdict when confirmed deal breaker exists", () => {
  const base = validAnalysisResponse();
  assertThrows(
    () =>
      normalizeAndValidateAnalysis(
        {
          ...base,
          analysis: { ...base.analysis, verdict: "worth_applying" },
          jobExtraction: { ...base.jobExtraction, dealBreakers: [{ label: "Requires active RN license", status: "confirmed" }] },
        },
        HAS_EVIDENCE,
      ),
    Error,
  );
});

Deno.test("normalizeAndValidateAnalysis allows high_risk when confirmed deal breaker exists", () => {
  const base = validAnalysisResponse();
  // apply_now is itself guarded against confirmed deal breakers (correctly —
  // see the "rejects positive verdict" case above), so this fixture also
  // needs a recommendation that's actually consistent with high_risk.
  const result = normalizeAndValidateAnalysis(
    {
      ...base,
      analysis: { ...base.analysis, verdict: "high_risk", applicationRecommendation: "consider" },
      jobExtraction: { ...base.jobExtraction, dealBreakers: [{ label: "Requires active RN license", status: "confirmed" }] },
    },
    HAS_EVIDENCE,
  );
  assertEquals(result.analysis.verdict, "high_risk");
});

Deno.test("normalizeAndValidateAnalysis forces not_yet_assessed and nulls fitScore when there is no candidate evidence", () => {
  const base = validAnalysisResponse();
  const result = normalizeAndValidateAnalysis(base, { hasResumeEvidence: false, hasProfileEvidence: false });
  assertEquals(result.analysis.verdict, "not_yet_assessed");
  assertEquals(result.analysis.candidateFit.fitScore, null);
  assertEquals(result.analysis.applicationRecommendation, "upload_resume_first");
});

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

Deno.test("validAnalysisResponse passes end-to-end schema validation", () => {
  const parsed = analysisResponseSchema.parse(validAnalysisResponse());
  assertEquals(parsed.analysis.candidateFit.fitScore, 7.4);
  assertEquals(parsed.analysis.verdict, "strong_match");
  assertEquals(parsed.promptVersion, CAREER_COACH_PROMPT_VERSION);
  assertEquals(parsed.resumeRanking[0].compatibilityScore, 82);
});
