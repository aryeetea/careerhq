import { assertSupabaseConfigured, supabase } from "@/lib/supabase";

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
      return new Error("You've requested a few codes already. Give it a minute, then try again.");
    }

    if (normalized.includes("invalid login credentials")) {
      return new Error("That email and password combination didn't match.");
    }

    if (normalized.includes("email not confirmed")) {
      return new Error("Check your inbox and verify your email before signing in with a password.");
    }

    if (
      normalized.includes("otp") ||
      normalized.includes("expired") ||
      normalized.includes("token") ||
      normalized.includes("verification code")
    ) {
      return new Error("That code is incorrect or expired. Request a new one and try again.");
    }

    if (normalized.includes("network") || normalized.includes("fetch")) {
      return new Error("Bloom couldn't reach the server. Check your connection and try again.");
    }

    return new Error(message);
  }

  return error instanceof Error ? error : new Error("Something went wrong with authentication.");
}

export async function signUp(email: string, password: string, displayName: string) {
  assertSupabaseConfigured();
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/login`,
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

export async function requestSignInOtp(email: string) {
  assertSupabaseConfigured();
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

export async function requestSignUpOtp(email: string, displayName: string) {
  assertSupabaseConfigured();
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: { display_name: displayName },
      },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

export async function verifyEmailOtp(email: string, token: string) {
  assertSupabaseConfigured();
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
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
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function resendVerificationEmail(email: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) throw error;
}
