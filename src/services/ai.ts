import { supabase } from "@/lib/supabase";
import {
  analyzeJobRequestSchema,
  generateCoverLetterRequestSchema,
  generateCoverLetterResponseSchema,
  jobAnalysisPayloadSchema,
  type AnalyzeJobRequest,
  type GenerateCoverLetterRequest,
  type GenerateCoverLetterResponse,
  type JobAnalysisPayload,
} from "@/lib/ai";

export async function analyzeJob(request: AnalyzeJobRequest): Promise<{ analysis: JobAnalysisPayload; selected_resume_id: string | null }> {
  const payload = analyzeJobRequestSchema.parse(request);
  const { data, error } = await supabase.functions.invoke("analyze-job", { body: payload });
  if (error) throw error;
  return {
    analysis: jobAnalysisPayloadSchema.parse(data.analysis),
    selected_resume_id: typeof data.selected_resume_id === "string" ? data.selected_resume_id : null,
  };
}

export async function generateCoverLetter(request: GenerateCoverLetterRequest): Promise<GenerateCoverLetterResponse> {
  const payload = generateCoverLetterRequestSchema.parse(request);
  const { data, error } = await supabase.functions.invoke("generate-cover-letter", { body: payload });
  if (error) throw error;
  return generateCoverLetterResponseSchema.parse(data);
}
