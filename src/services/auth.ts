import { assertSupabaseConfigured, supabase } from "@/lib/supabase";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";

function normalizeAuthError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: string }).message === "string"
  ) {
    const message = (error as { message: string }).message;
    const normalized = message.toLowerCase();

    if (normalized.includes("rate limit") || normalized.includes("security purposes")) {
      return new Error("You've requested a few links already. Give it a minute, then try again.");
    }

    if (normalized.includes("invalid login credentials")) {
      return new Error("That email and password combination didn't match.");
    }

    if (normalized.includes("email not confirmed")) {
      return new Error("Check your inbox and verify your email before signing in with a password.");
    }

    if (normalized.includes("signups not allowed") || normalized.includes("not found") || normalized.includes("user not found")) {
      return new Error("We couldn't find an account with that email. Try creating one instead.");
    }

    if (normalized.includes("network") || normalized.includes("fetch")) {
      return new Error("Bloom couldn't reach the server. Check your connection and try again.");
    }

    return new Error(message);
  }

  return error instanceof Error ? error : new Error("Something went wrong with authentication.");
}

async function ensureActiveSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) return session;

  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    throw normalizeAuthError(error);
  }

  if (!data.session) {
    throw new Error("Your session has expired. Sign in again, then update your password.");
  }

  return data.session;
}

export async function signUp(email: string, password: string, displayName: string, redirectPath = "/login") {
  assertSupabaseConfigured();
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}${redirectPath}`,
      },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

export async function signIn(email: string, password: string) {
  assertSupabaseConfigured();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

// Builds the /auth/callback URL the emailed magic link points to. `next` is
// where AuthCallback should send the user once the session is established
// (it re-checks onboarding status itself, so this is just "where they were
// headed," not a guarantee of the final destination).
function callbackUrl(next: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function requestSignInMagicLink(email: string, next = "/app") {
  assertSupabaseConfigured();
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: callbackUrl(next),
      },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

export async function requestSignUpMagicLink(email: string, displayName: string, next = "/onboarding") {
  assertSupabaseConfigured();
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: callbackUrl(next),
        data: { display_name: displayName },
      },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

export async function signOut() {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  assertSupabaseConfigured();
  try {
    await ensureActiveSession();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

export async function resendVerificationEmail(email: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) throw error;
}

// Permanently deletes the signed-in user's account: their files (resumes,
// certificates, avatar), then the auth user itself, which cascades through
// every foreign key in the schema (audited — all `on delete cascade` /
// `set null`, none `restrict`). Irreversible; the caller is responsible for
// getting explicit, typed confirmation before calling this.
export async function deleteMyAccount(): Promise<void> {
  assertSupabaseConfigured();
  try {
    await invokeEdgeFunction<{ deleted: true }>("delete-account");
  } catch (error) {
    throw normalizeAuthError(error);
  }
}
