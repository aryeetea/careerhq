import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import {
  analyzeJobRequestSchema,
  dailyEncouragementRequestSchema,
  dailyEncouragementResponseSchema,
  generateCoverLetterRequestSchema,
  generateCoverLetterResponseSchema,
  jobAnalysisPayloadSchema,
  suggestProfileCopyRequestSchema,
  suggestProfileCopyResponseSchema,
  tailorResumeRequestSchema,
  tailorResumeResponseSchema,
  type AnalyzeJobRequest,
  type DailyEncouragementResponse,
  type GenerateCoverLetterRequest,
  type GenerateCoverLetterResponse,
  type JobAnalysisPayload,
  type SuggestProfileCopyRequest,
  type SuggestProfileCopyResponse,
  type TailorResumeRequest,
  type TailorResumeResponse,
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

export async function tailorResume(request: TailorResumeRequest): Promise<TailorResumeResponse> {
  const payload = tailorResumeRequestSchema.parse(request);
  const data = await invokeEdgeFunction<unknown>("tailor-resume", payload);
  return tailorResumeResponseSchema.parse(data);
}

export async function suggestProfileCopy(request: SuggestProfileCopyRequest): Promise<SuggestProfileCopyResponse> {
  const payload = suggestProfileCopyRequestSchema.parse(request);
  const data = await invokeEdgeFunction<unknown>("suggest-profile-copy", payload);
  return suggestProfileCopyResponseSchema.parse(data);
}

// One AI call produces both the Dashboard and Profile messages together —
// the edge function itself caches per (user, calendar day), so calling
// this from both pages on the same day never triggers a second AI call.
// localDate is the caller's own calendar date, not the server's — see
// useDailyEncouragement for why the server must key its cache off this
// instead of computing "today" itself.
export async function getDailyEncouragement(localDate: string): Promise<DailyEncouragementResponse> {
  const payload = dailyEncouragementRequestSchema.parse({ localDate });
  const data = await invokeEdgeFunction<unknown>("generate-daily-encouragement", payload);
  return dailyEncouragementResponseSchema.parse(data);
}
