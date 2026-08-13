import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import {
  analyzeJobRequestSchema,
  dailyEncouragementResponseSchema,
  generateCoverLetterRequestSchema,
  generateCoverLetterResponseSchema,
  jobAnalysisPayloadSchema,
  suggestProfileCopyRequestSchema,
  suggestProfileCopyResponseSchema,
  type AnalyzeJobRequest,
  type DailyEncouragementResponse,
  type GenerateCoverLetterRequest,
  type GenerateCoverLetterResponse,
  type JobAnalysisPayload,
  type SuggestProfileCopyRequest,
  type SuggestProfileCopyResponse,
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

export async function suggestProfileCopy(request: SuggestProfileCopyRequest): Promise<SuggestProfileCopyResponse> {
  const payload = suggestProfileCopyRequestSchema.parse(request);
  const data = await invokeEdgeFunction<unknown>("suggest-profile-copy", payload);
  return suggestProfileCopyResponseSchema.parse(data);
}

// One AI call produces both the Dashboard and Profile messages together —
// the edge function itself caches per (user, calendar day), so calling
// this from both pages on the same day never triggers a second AI call.
export async function getDailyEncouragement(): Promise<DailyEncouragementResponse> {
  const data = await invokeEdgeFunction<unknown>("generate-daily-encouragement", {});
  return dailyEncouragementResponseSchema.parse(data);
}
