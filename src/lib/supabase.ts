import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const fallbackUrl = "https://placeholder.supabase.co";
const fallbackAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.c2lnbmF0dXJl";

export const supabaseConfigError = !url || !anonKey
  ? "Bloom isn't configured with Supabase client credentials. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy."
  : null;

if (supabaseConfigError) {
  // Fail loudly in development rather than shipping a silently-broken client.
  // eslint-disable-next-line no-console
  console.error(supabaseConfigError);
}

export const supabase = createClient(url ?? fallbackUrl, anonKey ?? fallbackAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = Boolean(url && anonKey);

export function assertSupabaseConfigured() {
  if (supabaseConfigError) {
    throw new Error(supabaseConfigError);
  }
}
