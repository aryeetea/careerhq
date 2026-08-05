import { corsHeaders, json } from "../_shared/cors.ts";
import { coverLetterRequestSchema } from "../_shared/schemas.ts";
import {
  enforceRateLimit,
  errorResponse,
  extractResumeText,
  generateCoverLetterText,
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
    await enforceRateLimit(adminClient, user.id, "generate_cover_letter", 60 * 60 * 1000, 12);

    const payload = coverLetterRequestSchema.parse(await request.json());
    const openai = getOpenAIClient();
    const job = await getJobForUser(adminClient, user.id, payload.jobId);
    const resumes = await getUserResumes(adminClient, user.id);

    const selectedResumeId = payload.selectedResumeId ?? job.resume_id ?? null;
    const selectedResume = resumes.find((resume) => resume.id === selectedResumeId) ?? null;
    const selectedResumeText = selectedResume ? await extractResumeText(openai, adminClient, selectedResume) : null;

    const response = await generateCoverLetterText(openai, {
      job,
      selectedResume: selectedResume && selectedResumeText
        ? { id: selectedResume.id, name: selectedResume.name, extractedText: selectedResumeText }
        : null,
      analysis: job.ai_extracted_data,
      rawJobText:
        typeof job.ai_extracted_data?.raw_job_text === "string"
          ? job.ai_extracted_data.raw_job_text
          : job.job_description ?? "",
    });

    const { error } = await adminClient
      .from("jobs")
      .update({
        ai_cover_letter: response.cover_letter,
        resume_id: response.resume_id ?? selectedResumeId,
      })
      .eq("id", job.id)
      .eq("user_id", user.id);
    if (error) throw error;

    return json(response);
  } catch (error) {
    const handled = errorResponse(error);
    return json(handled.body, handled.status);
  }
});
