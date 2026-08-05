import { supabase } from "@/lib/supabase";
import type { FriendCode, FriendCodeCreated, FriendCodeExpiration, FriendCodeMaxUses, FriendCodePreview } from "@/types/database";

export interface FriendCodeSettings {
  expiresIn: FriendCodeExpiration;
  maxUses: FriendCodeMaxUses;
}

// create/regenerate/revoke still raise on failure (genuine exceptional
// cases — bad max_uses, missing row, no session) and supabase-js surfaces
// that as `error`, forwarded as-is below.
//
// validate/use are different: they never raise for anticipated validation
// failures (invalid/expired/revoked/used/self/blocked/rate-limited) because
// an RPC that raises can't durably log the failed attempt — a RAISE rolls
// back everything in the same transaction, including audit-log writes made
// from an exception handler. Instead they always return a row shaped
// {success, error_message, ...}. These two functions unwrap that and throw
// a plain JS Error client-side, so callers (dialogs) keep a single
// try/catch contract regardless of which failure mode fired.

export async function listMyFriendCodes(): Promise<FriendCode[]> {
  const { data, error } = await supabase
    .from("friend_codes")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as FriendCode[];
}

export async function createFriendCode(settings: FriendCodeSettings): Promise<FriendCodeCreated> {
  const { data, error } = await supabase
    .rpc("create_friend_code", { p_expires_in: settings.expiresIn, p_max_uses: settings.maxUses })
    .single();
  if (error) throw error;
  return data as FriendCodeCreated;
}

export async function regenerateFriendCode(id: string, settings: FriendCodeSettings): Promise<FriendCodeCreated> {
  const { data, error } = await supabase
    .rpc("regenerate_friend_code", { p_id: id, p_expires_in: settings.expiresIn, p_max_uses: settings.maxUses })
    .single();
  if (error) throw error;
  return data as FriendCodeCreated;
}

export async function revokeFriendCode(id: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_friend_code", { p_id: id });
  if (error) throw error;
}

interface ValidateFriendCodeResult extends FriendCodePreview {
  success: boolean;
  error_message: string | null;
}

const GENERIC_CODE_ERROR = "We couldn't find that friend code. Check the characters and try again.";

export async function validateFriendCode(code: string): Promise<FriendCodePreview> {
  const { data, error } = await supabase.rpc("validate_friend_code", { p_code: code }).single();
  if (error) throw error;
  const result = data as ValidateFriendCodeResult;
  if (!result.success) throw new Error(result.error_message ?? GENERIC_CODE_ERROR);
  return result;
}

interface UseFriendCodeResult {
  success: boolean;
  error_message: string | null;
  request_id: string | null;
}

// The "spend" call — creates the pending friend_requests row via the
// existing friend-request system. Returns the friend_requests.id.
export async function useFriendCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("use_friend_code", { p_code: code }).single();
  if (error) throw error;
  const result = data as UseFriendCodeResult;
  if (!result.success || !result.request_id) throw new Error(result.error_message ?? GENERIC_CODE_ERROR);
  return result.request_id;
}
