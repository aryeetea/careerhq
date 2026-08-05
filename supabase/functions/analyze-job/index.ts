import { corsHeaders, json } from "../_shared/cors.ts";
import { analyzeJobRequestSchema } from "../_shared/schemas.ts";
import {
  analyzeJobAndResumes,
  enforceRateLimit,
  errorResponse,
  extractResumeText,
  fetchJobSource,
  getJobForUser,
  getOpenAIClient,
  getUserResumes,
  requireUser,
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

    const analysis = await analyzeJobAndResumes(openai, jobSource, readyResumes);

    if (savedJob) {
      const recommendedResumeId = analysis.recommendedResumeId;
      const nextResumeId = savedJob.resume_id ?? recommendedResumeId;
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
          fit_score: analysis.analysis.fitScore,
          verdict: analysis.analysis.verdict,
          // Note: jobs.priority is the user's own manual urgency ranking
          // (1-3) — a different concept from the AI's applicationPriority
          // (apply_now/apply_soon/consider/skip, stored only inside
          // ai_analysis). We never overwrite the user's priority here.
          strengths: analysis.analysis.strongMatches.join("\n"),
          missing_qualifications: [
            ...analysis.analysis.criticalGaps.map((item) => `Critical: ${item}`),
            ...analysis.analysis.preferredGaps.map((item) => `Preferred: ${item}`),
          ].join("\n"),
          ai_extracted_data: analysis.jobExtraction,
          ai_analysis: analysis,
          ai_recommended_resume_id: recommendedResumeId,
          ai_last_analyzed_at: new Date().toISOString(),
          ai_prompt_version: analysis.promptVersion,
          ai_rubric_version: analysis.analysis.rubricVersion,
          resume_id: nextResumeId,
        })
        .eq("id", savedJob.id)
        .eq("user_id", user.id);
      if (error) throw error;
      savedJob = await getJobForUser(adminClient, user.id, savedJob.id);
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
