import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Mirrors supabase/functions/_shared/utils.ts's AppErrorCode, plus
// "network_error" for failures that never reached the function at all
// (not deployed, DNS, CORS preflight rejected, offline, etc.) — those don't
// have a server-assigned code since no server code ran.
export type EdgeFunctionErrorCode =
  | "validation_error"
  | "unauthenticated"
  | "not_found"
  | "rate_limited"
  | "upstream_error"
  | "internal_error"
  | "not_configured"
  | "insufficient_context"
  | "network_error";

const KNOWN_CODES = new Set<EdgeFunctionErrorCode>([
  "validation_error",
  "unauthenticated",
  "not_found",
  "rate_limited",
  "upstream_error",
  "internal_error",
  "not_configured",
  "insufficient_context",
  "network_error",
]);

function isKnownCode(value: unknown): value is EdgeFunctionErrorCode {
  return typeof value === "string" && KNOWN_CODES.has(value as EdgeFunctionErrorCode);
}

/**
 * Thrown by invokeEdgeFunction for every failure mode — auth, validation,
 * rate limits, upstream/OpenAI errors, and network-level failures alike —
 * so callers can switch on `.code` for feature-specific copy instead of
 * pattern-matching on `.message` (which may be a safe-but-generic fallback).
 */
export class EdgeFunctionError extends Error {
  code: EdgeFunctionErrorCode;
  constructor(message: string, code: EdgeFunctionErrorCode) {
    super(message);
    this.name = "EdgeFunctionError";
    this.code = code;
  }
}

// supabase-js's functions.invoke() wraps ANY non-2xx response in a
// FunctionsHttpError whose .message is always the generic string "Edge
// Function returned a non-2xx status code" — the actual { error, code }
// body our Edge Functions send lives unread on error.context, a raw
// Response object. Without unwrapping it here, every backend rejection —
// expected 4xx or not — looks identical and unactionable to the user. See
// node_modules/@supabase/functions-js/src/FunctionsClient.ts (throws
// `new FunctionsHttpError(response)`) and types.ts (constructor sets
// context = that response, message = the generic string).
//
// Separately, if the function doesn't exist (wrong name, or committed but
// never deployed) the platform gateway 404s — including on the CORS
// preflight OPTIONS request. A non-2xx preflight response fails the
// browser's CORS check before the real request is ever sent, so the actual
// fetch() rejects and supabase-js throws FunctionsFetchError, whose message
// is the unhelpful "Failed to send a request to the Edge Function" — with
// no response body to unwrap at all. We map that to a clean, generic
// "network_error" rather than ever showing that string to a user.
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
    throw new EdgeFunctionError("Your session has expired. Please sign in again.", "unauthenticated");
  }

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let bodyError: string | null = null;
      let bodyCode: unknown = null;
      try {
        const errorBody = await (error.context as Response).clone().json();
        if (typeof errorBody?.error === "string" && errorBody.error) bodyError = errorBody.error;
        bodyCode = errorBody?.code;
      } catch {
        // Response body wasn't JSON (or already consumed) — e.g. the
        // platform's own {"code":"NOT_FOUND",...} 404 for an unknown
        // function slug. Fall through to the generic mapping below rather
        // than leaving the user with nothing, or leaking that raw body.
      }
      if (bodyError && isKnownCode(bodyCode)) throw new EdgeFunctionError(bodyError, bodyCode);
      if (bodyError) throw new EdgeFunctionError(bodyError, "internal_error");
      throw new EdgeFunctionError("AI suggestions aren't available right now. Please try again shortly.", "internal_error");
    }
    // FunctionsFetchError (network/CORS/not-deployed) or FunctionsRelayError —
    // nothing reached the function, so there's no server-assigned code.
    throw new EdgeFunctionError("AI suggestions aren't available right now. Please try again shortly.", "network_error");
  }
  return data as T;
}
