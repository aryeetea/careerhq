import { supabase } from "@/lib/supabase";
import type { MutualConnections, SuggestedFriend } from "@/types/database";

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
