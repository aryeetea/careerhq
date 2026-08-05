import { assertSupabaseConfigured, supabase } from "@/lib/supabase";

export async function signUp(email: string, password: string, displayName: string) {
  assertSupabaseConfigured();
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
}

export async function signIn(email: string, password: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function requestSignInOtp(email: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}/app`,
    },
  });
  if (error) throw error;
  return data;
}

export async function requestSignUpOtp(email: string, displayName: string) {
  assertSupabaseConfigured();
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
}

export async function verifyEmailOtp(email: string, token: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw error;
  return data;
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
