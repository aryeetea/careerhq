import { corsHeaders, json } from "../_shared/cors.ts";
import { tailorResumeRequestSchema } from "../_shared/schemas.ts";
import {
  AppError,
  enforceRateLimit,
  errorResponse,
  extractResumeText,
  generateTailoredResumeText,
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
    await enforceRateLimit(adminClient, user.id, "tailor_resume", 60 * 60 * 1000, 8);

    const payload = tailorResumeRequestSchema.parse(await request.json());
    const openai = getOpenAIClient();
    const job = await getJobForUser(adminClient, user.id, payload.jobId);
    const resumes = await getUserResumes(adminClient, user.id);

    const selectedResumeId = payload.selectedResumeId ?? job.resume_id ?? null;
    const selectedResume = resumes.find((resume) => resume.id === selectedResumeId) ?? null;
    // Unlike the cover letter (which can still draft something generic
    // with no résumé selected), tailoring has nothing to tailor without
    // one — fail clearly rather than asking the model to invent content.
    if (!selectedResume) {
      throw new AppError("Select a résumé to tailor before generating.", 400, "insufficient_context");
    }
    const selectedResumeText = await extractResumeText(openai, adminClient, selectedResume);
    if (!selectedResumeText) {
      throw new AppError("That résumé's text couldn't be read yet. Try re-uploading it.", 400, "insufficient_context");
    }

    const rawJobText =
      typeof job.ai_extracted_data?.rawJobText === "string" ? job.ai_extracted_data.rawJobText : job.job_description ?? "";

    const response = await generateTailoredResumeText(openai, {
      job,
      selectedResume: { id: selectedResume.id, name: selectedResume.name, extractedText: selectedResumeText },
      rawJobText,
      currentDraftText: payload.currentDraftText,
    });

    const { error } = await adminClient
      .from("jobs")
      .update({
        ai_resume_tailoring: response,
        ai_resume_tailoring_updated_at: new Date().toISOString(),
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
