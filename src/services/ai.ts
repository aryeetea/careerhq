import { invokeEdgeFunction } from "@/lib/edgeFunctions";
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
  const data = await invokeEdgeFunction<{ analysis: unknown; selected_resume_id: unknown }>("analyze-job", payload);
  return {
    analysis: jobAnalysisPayloadSchema.parse(data.analysis),
    selected_resume_id: typeof data.selected_resume_id === "string" ? data.selected_resume_id : null,
  };
}

export async function generateCoverLetter(request: GenerateCoverLetterRequest): Promise<GenerateCoverLetterResponse> {
  const payload = generateCoverLetterRequestSchema.parse(request);
  const data = await invokeEdgeFunction<unknown>("generate-cover-letter", payload);
  return generateCoverLetterResponseSchema.parse(data);
}
