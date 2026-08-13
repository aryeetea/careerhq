import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as aiService from "@/services/ai";

// Local calendar date, not UTC — a new key here should line up with the
// user's own sense of "today" changing, not a server clock they never see.
function localDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dashboard's one-liner + Profile's slightly warmer note, from a single
 * cached-per-day AI call. Both pages call this same hook — react-query
 * dedupes identical keys, so mounting it on both in one session still only
 * fires one request; the edge function's own per-day cache covers repeat
 * visits and page reloads on top of that. staleTime is generous since nothing
 * changes the message except the calendar date, which is baked into the key. */
export function useDailyEncouragement() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  // Computed once and reused for both the cache key and the request body —
  // the edge function used to compute "today" itself from its own server
  // clock (UTC), while this key is the user's local calendar date. Anyone
  // not near UTC had a multi-hour window each day (from their local
  // midnight until UTC's) where this hook already considered it a new day
  // and asked for a fresh message, but the server was still mid-way through
  // "yesterday" and handed back the cached row from before — the message
  // looked stuck instead of refreshing. Sending the same date the cache key
  // is built from means the server's cache partition always agrees with
  // what the client already decided "today" is.
  const dayKey = localDayKey();
  return useQuery({
    queryKey: queryKeys.dailyEncouragement(userId, dayKey),
    queryFn: () => aiService.getDailyEncouragement(dayKey),
    enabled: Boolean(userId),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
