import { FunctionsHttpError } from "@supabase/supabase-js";
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

// supabase-js's functions.invoke() wraps ANY non-2xx response in a
// FunctionsHttpError whose .message is always the generic string "Edge
// Function returned a non-2xx status code" — the actual { error: "..." }
// body our Edge Functions send (e.g. "We couldn't import that URL. Paste
// the job description to continue.", "You've hit the limit for AI
// requests...") lives unread on error.context, a raw Response object.
// Without unwrapping it here, every backend rejection — expected 4xx or
// not — looks identical and unactionable to the user. See
// node_modules/@supabase/functions-js/src/FunctionsClient.ts (throws
// `new FunctionsHttpError(response)`) and types.ts (constructor sets
// context = that response, message = the generic string).
async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let realMessage: string | null = null;
      try {
        const errorBody = await (error.context as Response).clone().json();
        if (typeof errorBody?.error === "string" && errorBody.error) realMessage = errorBody.error;
      } catch {
        // Response body wasn't JSON (or already consumed) — fall through
        // to the generic message below rather than leaving the user with
        // nothing.
      }
      if (realMessage) throw new Error(realMessage);
    }
    throw error;
  }
  return data as T;
}

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
