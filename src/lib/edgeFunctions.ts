import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// supabase-js's functions.invoke() wraps ANY non-2xx response in a
// FunctionsHttpError whose .message is always the generic string "Edge
// Function returned a non-2xx status code" — the actual { error: "..." }
// body our Edge Functions send lives unread on error.context, a raw
// Response object. Without unwrapping it here, every backend rejection —
// expected 4xx or not — looks identical and unactionable to the user. See
// node_modules/@supabase/functions-js/src/FunctionsClient.ts (throws
// `new FunctionsHttpError(response)`) and types.ts (constructor sets
// context = that response, message = the generic string).
//
// Separately: supabase-js's internal fetch wrapper (node_modules/@supabase/
// supabase-js/src/lib/fetch.ts, fetchWithAuth) sources the Authorization
// header dynamically per-request via getAccessToken(), and SILENTLY FALLS
// BACK to sending the anon key as the Bearer token if no live session is
// available at that exact moment (e.g. the access token expired and a
// background refresh hasn't resolved yet). The Edge Runtime gateway accepts
// the anon key fine — it's a validly-signed JWT for the project — so the
// request reaches the function, whose own requireUser() then rejects it
// with "Authentication required." because the anon key isn't a real user
// token. We avoid that whole class of failure by resolving the session
// ourselves first (forcing a refresh if needed) and passing that token
// explicitly, failing fast with an actionable message if there's truly no
// session, instead of letting a doomed request go out.
export async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
  let { data: sessionData } = await supabase.auth.getSession();
  // expires_at is Unix seconds, not ms — compare on the same scale as Date.now().
  const isExpiredOrMissing = !sessionData.session || (sessionData.session.expires_at ?? 0) * 1000 < Date.now();
  if (isExpiredOrMissing) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.data.session) sessionData = refreshed.data;
  }
  if (!sessionData.session?.access_token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });
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
