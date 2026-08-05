import { supabase } from "@/lib/supabase";
import type { ActivityEvent } from "@/types/database";

export async function listNotifications(userId: string, mutedTypes: string[] = [], limit = 30): Promise<ActivityEvent[]> {
  let query = supabase.from("activity_events").select("*").eq("recipient_id", userId);
  if (mutedTypes.length > 0) query = query.not("type", "in", `(${mutedTypes.join(",")})`);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data as ActivityEvent[];
}

export async function unreadCount(userId: string, mutedTypes: string[] = []): Promise<number> {
  let query = supabase.from("activity_events").select("id", { count: "exact", head: true }).eq("recipient_id", userId).is("read_at", null);
  if (mutedTypes.length > 0) query = query.not("type", "in", `(${mutedTypes.join(",")})`);
  const { count, error } = await query;
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
  try {
    const channel = supabase
      .channel(`activity-events-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events", filter: `recipient_id=eq.${userId}` },
        (payload) => onInsert(payload.new as ActivityEvent)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  } catch (error) {
    // Realtime is a progressive enhancement; polling-backed queries should
    // keep the UI usable even when CSP or browser policy blocks websockets.
    // eslint-disable-next-line no-console
    console.warn("Notifications realtime unavailable:", error);
    return () => void 0;
  }
}
