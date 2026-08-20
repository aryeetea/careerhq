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
import { AppError, knownBlockingSiteName, normalizeAndValidateAnalysis, type CandidateEvidenceContext } from "../utils.ts";
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
      logisticsConsiderations: [{ label: "Hybrid schedule", detail: "3 days on-site per week", preferenceMatch: "unspecified" }],
      companyLegitimacy: {
        riskLevel: "none",
        redFlags: [],
        note: "No indicators of a fraudulent posting were found in the listing.",
        webCheck: "not_checked",
        source: null,
        locationConfidence: "not_checked",
      },
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
      scoringDimensions: {
        qualificationFit: 8,
        transferableSkillsFit: 7,
        careerDirectionFit: 8,
        experienceSeniorityFit: 7,
        locationWorkArrangementFit: 8,
        legitimacyConfidence: 9,
      },
      careerDirectionNote: "This role sits squarely in the candidate's stated target direction of full-stack engineering.",
      gapSeverity: "moderate",
      recommendationPriority: "normal",
      applicationRecommendation: "apply_now",
      shouldApply: "Apply — your TypeScript and React evidence covers the core requirements well.",
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
  assertEquals(buildAnalysisPrompt().includes("A single missing preferred qualification must never collapse the score"), true);
});

Deno.test("buildAnalysisPrompt includes fitScore guidance", () => {
  const prompt = buildAnalysisPrompt();
  assertEquals(prompt.includes("fitScore must be a number from 0.0 to 10.0"), true);
  assertEquals(prompt.includes("The score represents current alignment with available candidate evidence"), true);
});

Deno.test("buildAnalysisPrompt tells the model to return only the five active verdict values", () => {
  const prompt = buildAnalysisPrompt();
  for (const v of ["strong_match", "worth_applying", "consider", "not_recommended", "not_yet_assessed"]) {
    assertEquals(prompt.includes(v), true, `Verdict "${v}" missing from prompt`);
  }
  // The legacy tiers stay valid in the data model (old rows, manual
  // selection) but the model must never be asked to produce them.
  assertEquals(prompt.includes("never return them yourself"), true);
});

Deno.test("buildAnalysisPrompt separates hard requirements from logistics/lifestyle considerations", () => {
  const prompt = buildAnalysisPrompt();
  assertEquals(prompt.includes("HARD REQUIREMENTS"), true);
  assertEquals(prompt.includes("LOGISTICS AND LIFESTYLE CONSIDERATIONS"), true);
  assertEquals(prompt.includes("never include relocation, travel, work arrangement"), true);
  assertEquals(
    prompt.includes("Do not let relocation, travel, on-site/hybrid requirements, or any other logistics factor automatically produce not_recommended"),
    true,
  );
});

Deno.test("buildAnalysisPrompt includes the explicit weighted rubric categories", () => {
  const prompt = buildAnalysisPrompt();
  for (const phrase of ["Required skills — 25%", "Relevant experience and responsibilities — 20%", "Career progression"]) {
    assertEquals(prompt.includes(phrase), true, `Missing phrase: "${phrase}"`);
  }
});

Deno.test("buildAnalysisPrompt includes legitimacyConfidence in the weighted rubric and ties it to fitScore", () => {
  const prompt = buildAnalysisPrompt();
  assertEquals(prompt.includes("Posting legitimacy / location confidence"), true);
  assertEquals(prompt.includes("legitimacyConfidence: how confident you are"), true);
  // The core fix this implements: legitimacy must move fitScore itself,
  // not just sit in companyLegitimacy/the verdict label.
  assertEquals(
    prompt.includes("do not let it move only the verdict or companyLegitimacy note while fitScore stays purely skills-based"),
    true,
  );
});

Deno.test("buildAnalysisPrompt tells the model not to penalize sparse/unfamiliar-company signals for legitimacyConfidence", () => {
  const prompt = buildAnalysisPrompt();
  assertEquals(prompt.includes("never lower it merely because reviews are sparse"), true);
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

Deno.test("normalizeAndValidateAnalysis rejects relocation/travel reported as a dealBreaker instead of a logistics consideration", () => {
  // Regression test for the Epic Entry-Level PM bug: relocation and travel
  // used to be reported as "confirmed" dealBreakers, which on their own
  // forced a "Not Recommended" verdict despite a genuinely strong
  // skill/experience fit. They must now be rejected from dealBreakers
  // entirely (see LOGISTICS_KEYWORD_PATTERN in utils.ts) and reported via
  // logisticsConsiderations instead.
  const base = validAnalysisResponse();
  assertThrows(
    () =>
      normalizeAndValidateAnalysis(
        {
          ...base,
          analysis: { ...base.analysis, verdict: "not_recommended" },
          jobExtraction: {
            ...base.jobExtraction,
            dealBreakers: [
              { label: "Relocation required to Madison, WI", status: "confirmed" },
              { label: "Travel up to 60%", status: "confirmed" },
            ],
          },
        },
        HAS_EVIDENCE,
      ),
    Error,
  );
});

Deno.test("normalizeAndValidateAnalysis allows worth_applying with a 7/10 score when relocation/travel are reported as logistics considerations, not dealBreakers", () => {
  // The corrected shape of the Epic Entry-Level PM example: strong
  // skill/experience evidence, no hard requirement issues, relocation and
  // travel surfaced separately — must validate cleanly at worth_applying.
  const base = validAnalysisResponse();
  const result = normalizeAndValidateAnalysis(
    {
      ...base,
      analysis: {
        ...base.analysis,
        verdict: "worth_applying",
        candidateFit: { ...base.analysis.candidateFit, fitScore: 7 },
      },
      jobExtraction: {
        ...base.jobExtraction,
        dealBreakers: [],
        logisticsConsiderations: [
          { label: "Relocation required", detail: "Relocation required: Madison, WI", preferenceMatch: "unspecified" },
          { label: "Travel expectation", detail: "Travel: approximately 25-60%", preferenceMatch: "unspecified" },
        ],
      },
    },
    HAS_EVIDENCE,
  );
  assertEquals(result.analysis.verdict, "worth_applying");
  assertEquals(result.analysis.candidateFit.fitScore, 7);
});

Deno.test("normalizeAndValidateAnalysis forces not_yet_assessed and nulls fitScore when there is no candidate evidence", () => {
  const base = validAnalysisResponse();
  const result = normalizeAndValidateAnalysis(base, { hasResumeEvidence: false, hasProfileEvidence: false });
  assertEquals(result.analysis.verdict, "not_yet_assessed");
  assertEquals(result.analysis.candidateFit.fitScore, null);
  assertEquals(result.analysis.applicationRecommendation, "upload_resume_first");
});

// ---------------------------------------------------------------------
// Prompt content: transferable experience by role, career direction,
// gap severity, and recommendation priority — the core of this redesign.
// ---------------------------------------------------------------------

Deno.test("buildAnalysisPrompt recognizes transferable experience for common role archetypes without requiring exact title matches", () => {
  const prompt = buildAnalysisPrompt();
  assertEquals(prompt.includes("Do not require exact job-title matching"), true);
  for (const role of ["Product Designer", "Project Coordinator", "Business Analyst", "Product Manager"]) {
    assertEquals(prompt.includes(`"${role}"`), true, `Missing role archetype: ${role}`);
  }
});

Deno.test("buildAnalysisPrompt treats career direction fit as separate from qualification fit", () => {
  const prompt = buildAnalysisPrompt();
  assertEquals(prompt.includes("CAREER DIRECTION FIT"), true);
  assertEquals(prompt.includes("Career direction fit is NOT the same as qualification fit"), true);
  assertEquals(prompt.includes("that combination is CONSIDER, not NOT RECOMMENDED"), true);
});

Deno.test("buildAnalysisPrompt defines gap severity tiers and restricts hard-only escalation", () => {
  const prompt = buildAnalysisPrompt();
  for (const tier of ["minor", "moderate", "major", "hard"]) {
    assertEquals(prompt.includes(tier), true, `Missing gap severity tier: ${tier}`);
  }
  assertEquals(prompt.includes("Only hard should strongly push the verdict toward not_recommended"), true);
});

Deno.test("buildAnalysisPrompt keeps recommendation priority distinct from career direction", () => {
  const prompt = buildAnalysisPrompt();
  assertEquals(prompt.includes("RECOMMENDATION PRIORITY"), true);
  assertEquals(
    prompt.includes("a job does not need to be a perfect career-direction match to be worth applying to, or even to be a high-priority application"),
    true,
  );
});

Deno.test("buildAnalysisPrompt tells the model to pick a resume for real experience, not keyword count", () => {
  assertEquals(buildAnalysisPrompt().includes("do not choose one merely because it repeats more of the posting's keywords"), true);
});

// ---------------------------------------------------------------------
// The seven scenarios from the redesign brief, exercised structurally
// through normalizeAndValidateAnalysis (schema + guardrails), since a
// live model call isn't available in a unit test. Each asserts that the
// intended, nuanced outcome validates cleanly, and — where the whole
// point is a contrast — that the overly harsh alternative is rejected.
// ---------------------------------------------------------------------

Deno.test("scenario 1: strong Product Designer match validates as strong_match with no meaningful gap", () => {
  const base = validAnalysisResponse();
  const result = normalizeAndValidateAnalysis(
    {
      ...base,
      analysis: {
        ...base.analysis,
        verdict: "strong_match",
        gapSeverity: "none",
        recommendationPriority: "high",
        scoringDimensions: { qualificationFit: 9, transferableSkillsFit: 9, careerDirectionFit: 9, experienceSeniorityFit: 8, locationWorkArrangementFit: 9, legitimacyConfidence: 9 },
        candidateFit: { ...base.analysis.candidateFit, fitScore: 8.8, criticalGaps: [] },
      },
    },
    HAS_EVIDENCE,
  );
  assertEquals(result.analysis.verdict, "strong_match");
});

Deno.test("scenario 2: strong Project Coordinator match validates as worth_applying with only minor gaps", () => {
  const base = validAnalysisResponse();
  const result = normalizeAndValidateAnalysis(
    {
      ...base,
      analysis: {
        ...base.analysis,
        verdict: "worth_applying",
        gapSeverity: "minor",
        recommendationPriority: "high",
        scoringDimensions: { qualificationFit: 8, transferableSkillsFit: 8, careerDirectionFit: 7, experienceSeniorityFit: 8, locationWorkArrangementFit: 8, legitimacyConfidence: 9 },
        candidateFit: { ...base.analysis.candidateFit, fitScore: 7.8 },
      },
      jobExtraction: { ...base.jobExtraction, dealBreakers: [] },
    },
    HAS_EVIDENCE,
  );
  assertEquals(result.analysis.verdict, "worth_applying");
});

Deno.test("scenario 3: entry-level PM with transferable (not title-matched) experience validates as worth_applying", () => {
  const base = validAnalysisResponse();
  const result = normalizeAndValidateAnalysis(
    {
      ...base,
      analysis: {
        ...base.analysis,
        verdict: "worth_applying",
        gapSeverity: "minor",
        recommendationPriority: "normal",
        scoringDimensions: { qualificationFit: 7, transferableSkillsFit: 8, careerDirectionFit: 7, experienceSeniorityFit: 7, locationWorkArrangementFit: 8, legitimacyConfidence: 9 },
        candidateFit: {
          ...base.analysis.candidateFit,
          fitScore: 7.2,
          strongMatches: ["B.S. in Information Technology", "Project coordination via ACE Web Studio"],
          transferableStrengths: ["Timeline and deliverable management", "Client and stakeholder communication"],
        },
      },
      jobExtraction: { ...base.jobExtraction, dealBreakers: [] },
    },
    HAS_EVIDENCE,
  );
  assertEquals(result.analysis.verdict, "worth_applying");
});

Deno.test('scenario 4/7: specialized PM with a moderate domain gap and lower career-direction fit validates as consider — the exact "Fair Market Value" shape — and rejects the same shape at not_recommended', () => {
  const base = validAnalysisResponse();
  const scoredForConsider = {
    ...base,
    analysis: {
      ...base.analysis,
      gapSeverity: "moderate" as const,
      recommendationPriority: "backup" as const,
      scoringDimensions: { qualificationFit: 7.5, transferableSkillsFit: 8, careerDirectionFit: 6, experienceSeniorityFit: 7, locationWorkArrangementFit: 8, legitimacyConfidence: 9 },
      candidateFit: {
        ...base.analysis.candidateFit,
        fitScore: 6.4,
        strongMatches: ["Project coordination through ACE Web Studio", "B.S. in Information Technology"],
        criticalGaps: [],
        preferredGaps: ["Direct Fair Market Value / AXIA / vendor-metadata experience"],
      },
      careerDirectionNote: "More specialized operational project management than the product/digital roles primarily targeted.",
    },
    jobExtraction: { ...base.jobExtraction, dealBreakers: [] },
  };

  // The nuanced, correct outcome: CONSIDER.
  const considerResult = normalizeAndValidateAnalysis({ ...scoredForConsider, analysis: { ...scoredForConsider.analysis, verdict: "consider" } }, HAS_EVIDENCE);
  assertEquals(considerResult.analysis.verdict, "consider");

  // The old, too-binary outcome this redesign fixes: the same evidence
  // must NOT be allowed to reach NOT RECOMMENDED — no confirmed hard
  // requirement issue and gapSeverity is only "moderate."
  assertThrows(
    () => normalizeAndValidateAnalysis({ ...scoredForConsider, analysis: { ...scoredForConsider.analysis, verdict: "not_recommended" } }, HAS_EVIDENCE),
    Error,
  );
});

Deno.test("scenario 5: mid-senior role exceeding the candidate's experience validates as stretch_opportunity with a major gap", () => {
  const base = validAnalysisResponse();
  const result = normalizeAndValidateAnalysis(
    {
      ...base,
      analysis: {
        ...base.analysis,
        verdict: "stretch_opportunity",
        gapSeverity: "major",
        recommendationPriority: "backup",
        scoringDimensions: { qualificationFit: 5, transferableSkillsFit: 6, careerDirectionFit: 7, experienceSeniorityFit: 3, locationWorkArrangementFit: 8, legitimacyConfidence: 9 },
        candidateFit: { ...base.analysis.candidateFit, fitScore: 4.2, criticalGaps: ["8+ years leading engineering orgs, candidate has 2"] },
      },
      jobExtraction: { ...base.jobExtraction, dealBreakers: [] },
    },
    HAS_EVIDENCE,
  );
  assertEquals(result.analysis.verdict, "stretch_opportunity");
});

Deno.test("scenario 6: role with a hard certification requirement the candidate lacks validates as not_recommended, but only because of the confirmed hard requirement", () => {
  const base = validAnalysisResponse();
  const result = normalizeAndValidateAnalysis(
    {
      ...base,
      analysis: {
        ...base.analysis,
        verdict: "not_recommended",
        gapSeverity: "hard",
        recommendationPriority: "backup",
        applicationRecommendation: "skip",
        candidateFit: { ...base.analysis.candidateFit, criticalGaps: ["Active PMP certification required; candidate does not hold one"] },
      },
      jobExtraction: {
        ...base.jobExtraction,
        dealBreakers: [{ label: "Active PMP certification required", status: "confirmed" }],
      },
    },
    HAS_EVIDENCE,
  );
  assertEquals(result.analysis.verdict, "not_recommended");
  assertEquals(result.analysis.gapSeverity, "hard");
});

Deno.test("guard: stretch_opportunity requires gapSeverity major or hard, not moderate", () => {
  const base = validAnalysisResponse();
  assertThrows(
    () =>
      normalizeAndValidateAnalysis(
        { ...base, analysis: { ...base.analysis, verdict: "stretch_opportunity", gapSeverity: "moderate" } },
        HAS_EVIDENCE,
      ),
    Error,
  );
});

Deno.test("guard: recommendationPriority high cannot coexist with verdict not_recommended", () => {
  const base = validAnalysisResponse();
  assertThrows(
    () =>
      normalizeAndValidateAnalysis(
        {
          ...base,
          analysis: { ...base.analysis, verdict: "not_recommended", gapSeverity: "hard", recommendationPriority: "high" },
          jobExtraction: { ...base.jobExtraction, dealBreakers: [{ label: "Required security clearance", status: "confirmed" }] },
        },
        HAS_EVIDENCE,
      ),
    Error,
  );
});

// ---------------------------------------------------------------------
// knownBlockingSiteName — Indeed/LinkedIn/Glassdoor return a 403 to
// server-side fetches (verified directly against a live Indeed job URL
// during this investigation) regardless of headers used. This just needs
// to name the site correctly so fetchJobSource's 422 error is specific
// instead of a generic "couldn't import" that reads like Bloom's own bug.
// ---------------------------------------------------------------------

Deno.test("knownBlockingSiteName recognizes Indeed, including www and job-view paths", () => {
  assertEquals(knownBlockingSiteName("https://www.indeed.com/viewjob?jk=2296af613d86e685"), "Indeed");
  assertEquals(knownBlockingSiteName("https://indeed.com/jobs?q=engineer"), "Indeed");
});

Deno.test("knownBlockingSiteName recognizes LinkedIn and Glassdoor, including subdomains", () => {
  assertEquals(knownBlockingSiteName("https://www.linkedin.com/jobs/view/12345"), "LinkedIn");
  assertEquals(knownBlockingSiteName("https://de.linkedin.com/jobs/view/12345"), "LinkedIn");
  assertEquals(knownBlockingSiteName("https://www.glassdoor.com/job-listing/x"), "Glassdoor");
});

Deno.test("knownBlockingSiteName returns null for unrelated hosts and malformed URLs", () => {
  assertEquals(knownBlockingSiteName("https://boards.greenhouse.io/acme/jobs/123"), null);
  assertEquals(knownBlockingSiteName("https://myindeedjobs.example.com/x"), null);
  assertEquals(knownBlockingSiteName("not a url"), null);
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
