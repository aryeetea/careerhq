import { supabase } from "@/lib/supabase";
import type { FriendInviteLink, FriendInviteLinkPreview, MutualConnections, SuggestedFriend } from "@/types/database";

export interface FriendInviteLinkSettings {
  expiresAt: string | null;
  maxUses: number | null;
}

export async function listMyFriendInviteLinks(): Promise<FriendInviteLink[]> {
  const { data, error } = await supabase
    .from("friend_invite_links")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as FriendInviteLink[];
}

export async function createFriendInviteLink(settings: FriendInviteLinkSettings): Promise<FriendInviteLink> {
  const { data, error } = await supabase
    .from("friend_invite_links")
    .insert({ expires_at: settings.expiresAt, max_uses: settings.maxUses })
    .select("*")
    .single();
  if (error) throw error;
  return data as FriendInviteLink;
}

export async function disableFriendInviteLink(id: string): Promise<void> {
  const { error } = await supabase.from("friend_invite_links").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

// Regenerating a link means the old one can no longer be used even by
// someone who already has it copied — disable it, then mint a fresh token
// with the same settings, rather than mutating the existing row in place.
export async function regenerateFriendInviteLink(id: string, settings: FriendInviteLinkSettings): Promise<FriendInviteLink> {
  await disableFriendInviteLink(id);
  return createFriendInviteLink(settings);
}

export async function previewFriendInviteLink(token: string): Promise<FriendInviteLinkPreview | null> {
  const { data, error } = await supabase.rpc("preview_friend_invite_link", { p_token: token });
  if (error) throw error;
  return ((data as FriendInviteLinkPreview[] | null) ?? [])[0] ?? null;
}

export async function acceptFriendInviteLink(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_friend_invite_link", { p_token: token });
  if (error) throw error;
  return data as string;
}

export async function getMutualConnections(friendId: string): Promise<MutualConnections> {
  const { data, error } = await supabase.rpc("get_mutual_connections", { p_user_id: friendId }).single();
  if (error) throw error;
  return data as MutualConnections;
}

export async function suggestFriends(limit = 6): Promise<SuggestedFriend[]> {
  const { data, error } = await supabase.rpc("suggest_friends", { p_limit: limit });
  if (error) throw error;
  return (data as SuggestedFriend[]) ?? [];
}
