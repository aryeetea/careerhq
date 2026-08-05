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
      const recommendedResumeId = analysis.recommended_resume_id;
      const nextResumeId = savedJob.resume_id ?? recommendedResumeId;
      const { error } = await adminClient
        .from("jobs")
        .update({
          company: analysis.extracted_job.company ?? savedJob.company,
          title: analysis.extracted_job.title ?? savedJob.title,
          location: analysis.extracted_job.location ?? savedJob.location,
          salary: analysis.extracted_job.salary ?? savedJob.salary,
          work_arrangement: analysis.extracted_job.work_arrangement ?? savedJob.work_arrangement,
          deadline: analysis.extracted_job.deadline ?? savedJob.deadline,
          job_url: jobUrl ?? savedJob.job_url,
          job_description: analysis.extracted_job.raw_job_text,
          fit_score: analysis.fit_score,
          verdict: analysis.verdict,
          priority: analysis.priority,
          strengths: analysis.matching_strengths.join("\n"),
          missing_qualifications: [
            ...analysis.missing_required_qualifications.map((item) => `Required: ${item}`),
            ...analysis.missing_preferred_qualifications.map((item) => `Preferred: ${item}`),
          ].join("\n"),
          ai_extracted_data: analysis.extracted_job,
          ai_analysis: analysis,
          ai_recommended_resume_id: recommendedResumeId,
          ai_last_analyzed_at: new Date().toISOString(),
          resume_id: nextResumeId,
        })
        .eq("id", savedJob.id)
        .eq("user_id", user.id);
      if (error) throw error;
      savedJob = await getJobForUser(adminClient, user.id, savedJob.id);
    }

    return json({
      analysis,
      selected_resume_id: savedJob?.resume_id ?? analysis.recommended_resume_id,
    });
  } catch (error) {
    const handled = errorResponse(error);
    return json(handled.body, handled.status);
  }
});
