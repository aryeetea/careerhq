import { supabase } from "@/lib/supabase";
import type { PushSubscriptionRow } from "@/types/database";

export async function listPushSubscriptions(userId: string): Promise<PushSubscriptionRow[]> {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PushSubscriptionRow[];
}

export async function deletePushSubscriptionById(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}
