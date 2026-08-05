import { supabase } from "@/lib/supabase";
import type { Profile, Settings, PrivacySettings } from "@/types/database";
import { replaceFile, deleteFile } from "@/services/storage";

function placeholderUsername(userId: string) {
  return `user_${userId.replace(/-/g, "").slice(0, 12)}`;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<Profile> {
  const { id: _omit, ...safePatch } = patch as Profile;
  const { data, error } = await supabase.from("profiles").update(safePatch).eq("id", userId).select("*").single();
  if (error) throw error;
  return data as Profile;
}

export async function completeOnboarding(userId: string, patch: Partial<Profile>): Promise<Profile> {
  const now = new Date().toISOString();
  const { id: _omit, username, display_name, ...safePatch } = patch as Profile;
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        username: username ?? placeholderUsername(userId),
        display_name: display_name ?? "You",
        ...safePatch,
        onboarded_at: now,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
  const query = supabase.from("profiles").select("id").eq("username", username).limit(1);
  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return true;
  return data[0].id === excludeUserId;
}

export async function updateAvatar(userId: string, oldPath: string | null, file: File): Promise<{ path: string; profile: Profile }> {
  const path = await replaceFile("avatars", userId, oldPath, file);
  const profile = await updateProfile(userId, { avatar_url: path });
  return { path, profile };
}

export async function removeAvatar(userId: string, path: string | null): Promise<Profile> {
  if (path) await deleteFile("avatars", path).catch(() => void 0);
  return updateProfile(userId, { avatar_url: null });
}

export async function getSettings(userId: string): Promise<Settings | null> {
  const { data, error } = await supabase.from("settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as Settings | null) ?? null;
}

export async function updateSettings(userId: string, patch: Partial<Settings>): Promise<Settings> {
  const { data, error } = await supabase.from("settings").update(patch).eq("user_id", userId).select("*").single();
  if (error) throw error;
  return data as Settings;
}

export async function getPrivacySettings(userId: string): Promise<PrivacySettings | null> {
  const { data, error } = await supabase.from("privacy_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as PrivacySettings | null) ?? null;
}

export async function updatePrivacySettings(userId: string, patch: Partial<PrivacySettings>): Promise<PrivacySettings> {
  const { data, error } = await supabase.from("privacy_settings").update(patch).eq("user_id", userId).select("*").single();
  if (error) throw error;
  return data as PrivacySettings;
}

export async function setSelectedFriends(ownerId: string, friendIds: string[]): Promise<void> {
  const { error: delErr } = await supabase.from("privacy_selected_friends").delete().eq("owner_id", ownerId);
  if (delErr) throw delErr;
  if (friendIds.length === 0) return;
  const { error } = await supabase
    .from("privacy_selected_friends")
    .insert(friendIds.map((friend_id) => ({ owner_id: ownerId, friend_id })));
  if (error) throw error;
}

export interface SharedContextProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

/** Resolves basic display info (never career_goal/locations/notes) for
 * people the caller shares a goal or group with — used to show names on
 * shared-goal and group member lists. */
export async function getSharedContextProfiles(userIds: string[]): Promise<SharedContextProfile[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase.rpc("get_shared_context_profiles", { p_user_ids: userIds });
  if (error) throw error;
  return data as SharedContextProfile[];
}

export async function listSelectedFriends(ownerId: string): Promise<string[]> {
  const { data, error } = await supabase.from("privacy_selected_friends").select("friend_id").eq("owner_id", ownerId);
  if (error) throw error;
  return (data ?? []).map((r) => r.friend_id as string);
}
