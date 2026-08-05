import { supabase } from "@/lib/supabase";
import type { ActivityEvent } from "@/types/database";

export async function listNotifications(userId: string, limit = 30): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("activity_events")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ActivityEvent[];
}

export async function unreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("activity_events")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markRead(id: string): Promise<void> {
  const { error } = await supabase.from("activity_events").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("activity_events")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

/** Subscribes to new activity_events for this user via Supabase Realtime. Returns an unsubscribe function. */
export function subscribeToNotifications(userId: string, onInsert: (event: ActivityEvent) => void): () => void {
  const channel = supabase
    .channel(`activity-events-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "activity_events", filter: `recipient_id=eq.${userId}` },
      (payload) => onInsert(payload.new as ActivityEvent)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
