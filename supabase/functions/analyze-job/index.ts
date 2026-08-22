import { corsHeaders, json } from "../_shared/cors.ts";
import { analyzeJobRequestSchema } from "../_shared/schemas.ts";
import {
  analyzeJobAndResumes,
  enforceRateLimit,
  enrichCompanyLegitimacyWithWebCheck,
  errorResponse,
  extractResumeText,
  fetchJobSource,
  getCandidateCareerDirection,
  getCandidatePreferences,
  getConfirmedHardRequirementFacts,
  getJobForUser,
  getOpenAIClient,
  getUserResumes,
  requireUser,
  sendPushToUser,
} from "../_shared/utils.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, adminClient } = await requireUser(request.headers.get("Authorization"));
    await enforceRateLimit(adminClient, user.id, "analyze_job", 60 * 60 * 1000, 8);

    const payload = analyzeJobRequestSchema.parse(await request.json());
    const openai = getOpenAIClient();

    let savedJob = payload.jobId ? await getJobForUser(adminClient, user.id, payload.jobId) : null;
    const jobUrl = payload.jobUrl ?? savedJob?.job_url ?? undefined;
    const manualDescription = payload.manualJobDescription ?? savedJob?.job_description ?? undefined;
    const jobSource = await fetchJobSource(jobUrl, manualDescription);

    const resumes = await getUserResumes(adminClient, user.id);
    const resumeTexts = await Promise.all(
      resumes.map(async (resume) => ({
        id: resume.id,
        name: resume.name,
        target_role: resume.target_role,
        extracted_text: await extractResumeText(openai, adminClient, resume),
      }))
    );

    const readyResumes = resumeTexts.filter((resume): resume is { id: string; name: string; target_role: string | null; extracted_text: string } =>
      Boolean(resume.extracted_text)
    );

    const candidatePreferences = await getCandidatePreferences(adminClient, user.id);
    const candidateCareerDirection = await getCandidateCareerDirection(adminClient, user.id);
    const confirmedFacts = await getConfirmedHardRequirementFacts(adminClient, user.id);

    const rawAnalysis = await analyzeJobAndResumes(
      openai,
      jobSource,
      readyResumes,
      { hasResumeEvidence: readyResumes.length > 0, hasProfileEvidence: false },
      candidatePreferences,
      candidateCareerDirection,
      confirmedFacts,
    );
    // A real web search on top of the model's text-only read of the
    // posting (see SCAM RED FLAGS in careerCoach.ts) — never throws, so a
    // search-API hiccup degrades to the text-only result instead of
    // failing the whole analysis.
    const analysis = await enrichCompanyLegitimacyWithWebCheck(rawAnalysis);

    if (savedJob) {
      const recommendedResumeId = analysis.recommendedResumeId;
      const nextResumeId = savedJob.resume_id ?? recommendedResumeId;
      // A verdict/fit score the user set (or already kept) by hand must
      // never be silently overwritten by a later AI re-analysis — the
      // fresh AI take is still saved in full below (ai_analysis,
      // ai_extracted_data, strengths, gaps, …), just not promoted to the
      // job's headline verdict/fit_score fields. See migration 0040.
      const verdictLocked = savedJob.verdict_source === "user";
      const { error } = await adminClient
        .from("jobs")
        .update({
          company: analysis.jobExtraction.company ?? savedJob.company,
          title: analysis.jobExtraction.jobTitle ?? savedJob.title,
          location: analysis.jobExtraction.location ?? savedJob.location,
          salary: analysis.jobExtraction.salary ?? savedJob.salary,
          work_arrangement: analysis.jobExtraction.workArrangement ?? savedJob.work_arrangement,
          deadline: analysis.jobExtraction.applicationDeadline ?? savedJob.deadline,
          job_url: jobUrl ?? savedJob.job_url,
          job_description: analysis.jobExtraction.rawJobText,
          fit_score: verdictLocked ? savedJob.fit_score : analysis.analysis.candidateFit.fitScore,
          verdict: verdictLocked
            ? savedJob.verdict
            : analysis.analysis.verdict === "not_yet_assessed"
              ? null
              : analysis.analysis.verdict,
          verdict_source: verdictLocked ? "user" : "ai",
          // Note: jobs.priority is the user's own manual urgency ranking
          // (1-3) — a different concept from the AI's applicationPriority
          // (apply_now/apply_soon/consider/skip, stored only inside
          // ai_analysis). We never overwrite the user's priority here.
          strengths: analysis.analysis.candidateFit.strongMatches.join("\n"),
          missing_qualifications: [
            ...analysis.analysis.candidateFit.criticalGaps.map((item) => `Critical: ${item}`),
            ...analysis.analysis.candidateFit.preferredGaps.map((item) => `Preferred: ${item}`),
          ].join("\n"),
          ai_extracted_data: analysis.jobExtraction,
          ai_analysis: analysis,
          ai_recommended_resume_id: recommendedResumeId,
          ai_last_analyzed_at: new Date().toISOString(),
          ai_prompt_version: analysis.promptVersion,
          resume_id: nextResumeId,
        })
        .eq("id", savedJob.id)
        .eq("user_id", user.id);
      if (error) throw error;
      savedJob = await getJobForUser(adminClient, user.id, savedJob.id);

      // Push, not just the response below: analysis can take 30-70s (see
      // ANALYSIS_TIMEOUT_MS), long enough that a user on their phone has
      // often switched away from Bloom by the time it finishes — this is
      // what actually reaches them there. Mirrors getPendingRequirement
      // Confirmations (src/lib/jobRequirements.ts) so the push agrees with
      // what the job card itself will show: an unconfirmed possible/
      // insufficient_information dealBreaker not already answered.
      const confirmedKeys = new Set(confirmedFacts.map((fact) => fact.requirementKey));
      const pendingCount = analysis.jobExtraction.dealBreakers.filter(
        (item) => item.requirementKey && (item.status === "possible" || item.status === "insufficient_information") && !confirmedKeys.has(item.requirementKey),
      ).length;
      const jobLabel = [analysis.jobExtraction.jobTitle, analysis.jobExtraction.company].filter(Boolean).join(" at ") || "this posting";
      sendPushToUser(adminClient, user.id, {
        title: pendingCount > 0 ? "Requirement to confirm" : "Job analysis ready",
        body:
          pendingCount > 0
            ? `${jobLabel} has ${pendingCount} hard requirement${pendingCount === 1 ? "" : "s"} you can confirm.`
            : `Your analysis for ${jobLabel} is ready.`,
        url: `/jobs/${savedJob.id}`,
        tag: `bloom-job-analysis-${savedJob.id}`,
      }).catch((err) => console.error("Push send failed (analyze-job)", err));
    }

    return json({
      analysis,
      selected_resume_id: savedJob?.resume_id ?? analysis.recommendedResumeId,
    });
  } catch (error) {
    const handled = errorResponse(error);
    return json(handled.body, handled.status);
  }
});
