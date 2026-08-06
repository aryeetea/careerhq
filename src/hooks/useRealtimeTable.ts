import * as React from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface UseRealtimeTableOptions<T extends object> {
  /** A unique-per-purpose name — used as the channel id so two hooks
   * subscribing to the same table for different reasons don't collide. */
  channel: string;
  table: string;
  /** Postgres realtime filter, e.g. `user_id=eq.<uuid>`. Omit to receive
   * every row RLS allows this connection to see (used when the point IS
   * cross-user visibility, like a friend's shared journal entry). */
  filter?: string;
  enabled?: boolean;
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void;
}

/**
 * One postgres_changes subscription, with the same fail-open safety used
 * everywhere else Bloom talks to Realtime: if the socket can't connect —
 * CSP, browser policy, offline — the UI keeps working off its last fetch
 * instead of crashing or spamming the console. RLS is enforced by
 * Postgres itself for realtime the same way it is for a normal query, so
 * an unfiltered subscription never delivers a row this connection
 * couldn't already SELECT.
 */
export function useRealtimeTable<T extends object = Record<string, unknown>>({
  channel,
  table,
  filter,
  enabled = true,
  onChange,
}: UseRealtimeTableOptions<T>) {
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  React.useEffect(() => {
    if (!enabled) return;
    let liveChannel: ReturnType<typeof supabase.channel> | null = null;

    try {
      liveChannel = supabase
        .channel(channel)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          (payload) => onChangeRef.current(payload as RealtimePostgresChangesPayload<T>)
        )
        .subscribe();
    } catch (error) {
      console.warn(`Realtime unavailable for ${table}:`, error);
    }

    return () => {
      if (liveChannel) void supabase.removeChannel(liveChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, table, filter, enabled]);
}
