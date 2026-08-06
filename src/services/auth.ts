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
      return new Error("You've made a few requests already. Give it a minute, then try again.");
    }

    if (normalized.includes("invalid login credentials")) {
      return new Error("That email and password combination didn't match.");
    }

    if (normalized.includes("email not confirmed")) {
      return new Error("Check your inbox and verify your email before signing in.");
    }

    if (normalized.includes("user already registered") || normalized.includes("already registered")) {
      return new Error("An account with that email already exists. Try signing in instead.");
    }

    if (
      normalized.includes("password should be at least") ||
      normalized.includes("password is too weak") ||
      normalized.includes("should contain at least")
    ) {
      return new Error("Choose a stronger password — at least 8 characters.");
    }

    if (normalized.includes("signups not allowed") || normalized.includes("not found") || normalized.includes("user not found")) {
      return new Error("We couldn't find an account with that email. Try creating one instead.");
    }

    if (normalized.includes("network") || normalized.includes("fetch")) {
      return new Error("Bloom couldn't reach the server. Check your connection and try again.");
    }

    return new Error(message);
  }

  return error instanceof Error ? error : new Error("Couldn't sign you in. Try again in a moment.");
}

async function ensureActiveSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) return session;

  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) {
    throw new Error("This reset link has expired. Request a new one from the forgot password page.");
  }

  return data.session;
}

// Builds the /auth/callback URL used by both the signup confirmation email
// and the password reset email. `next` is where AuthCallback should send the
// user once the session from that link is established (it re-checks
// onboarding status itself, so this is just "where they were headed," not a
// guarantee of the final destination). Never used for passwordless sign-in.
function authCallbackUrl(next: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signUp(email: string, password: string, displayName: string, next = "/app") {
  assertSupabaseConfigured();
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: authCallbackUrl(next),
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

export async function signOut() {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackUrl("/reset-password"),
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
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: authCallbackUrl("/app") },
  });
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
