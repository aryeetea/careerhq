import { supabase } from "@/lib/supabase";
import { getVisibleBasicProfiles } from "@/services/profiles";
import type { FriendCard, FriendRequest } from "@/types/database";

export interface UserSearchResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export async function searchUsersByUsername(query: string): Promise<UserSearchResult[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await supabase.rpc("search_users_by_username", { p_query: query.trim() });
  if (error) throw error;
  return data as UserSearchResult[];
}

export async function sendFriendRequest(recipientId: string): Promise<FriendRequest> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("friend_requests")
    .insert({ requester_id: userData.user!.id, recipient_id: recipientId })
    .select("*")
    .single();
  if (error) throw error;
  return data as FriendRequest;
}

export async function listIncomingRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("recipient_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as FriendRequest[];
}

export async function listOutgoingRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("requester_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as FriendRequest[];
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_friend_request", { p_request_id: requestId });
  if (error) throw error;
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.from("friend_requests").update({ status: "declined" }).eq("id", requestId);
  if (error) throw error;
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.from("friend_requests").update({ status: "cancelled" }).eq("id", requestId);
  if (error) throw error;
}

export async function listFriendIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_id_a, user_id_b")
    .or(`user_id_a.eq.${userId},user_id_b.eq.${userId}`);
  if (error) throw error;
  return (data ?? []).map((row) => (row.user_id_a === userId ? row.user_id_b : row.user_id_a));
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  const lo = userId < friendId ? userId : friendId;
  const hi = userId < friendId ? friendId : userId;
  const { error } = await supabase.from("friendships").delete().eq("user_id_a", lo).eq("user_id_b", hi);
  if (error) throw error;
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from("user_blocks").insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
  await removeFriend(blockerId, blockedId).catch(() => void 0);
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function listBlockedUsers(blockerId: string): Promise<string[]> {
  const { data, error } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", blockerId);
  if (error) throw error;
  return (data ?? []).map((r) => r.blocked_id as string);
}

export async function getFriendCard(friendUserId: string): Promise<FriendCard> {
  const { data, error } = await supabase.rpc("get_friend_card", { p_user_id: friendUserId }).single();
  if (error) throw error;
  return data as FriendCard;
}

export async function getFriendCards(friendUserIds: string[]): Promise<FriendCard[]> {
  if (friendUserIds.length === 0) return [];

  const results = await Promise.allSettled(friendUserIds.map((id) => getFriendCard(id)));
  const detailedCards = new Map<string, FriendCard>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      detailedCards.set(result.value.user_id, result.value);
    }
  }

  const missingIds = friendUserIds.filter((id) => !detailedCards.has(id));

  if (missingIds.length > 0) {
    const basicProfiles = await getVisibleBasicProfiles(missingIds).catch(() => []);

    for (const profile of basicProfiles) {
      detailedCards.set(profile.id, {
        user_id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        status_message: null,
        career_status: null,
        applications_this_week: null,
        applications_this_month: null,
        weekly_goal: null,
        interviews_count: null,
        offers_count: null,
        current_streak: null,
        certification_name: null,
        certification_percentage: null,
      });
    }
  }

  return friendUserIds.map((id) => detailedCards.get(id)).filter((card): card is FriendCard => Boolean(card));
}
