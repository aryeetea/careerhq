import { useJobsRealtime } from "@/hooks/queries/useJobs";
import { useJournalRealtime } from "@/hooks/queries/useJournal";
import { useFriendRealtime } from "@/hooks/queries/useFriends";
import { useGroupsRealtime } from "@/hooks/queries/useGroups";
import { useGoalsRealtime } from "@/hooks/queries/useGoals";

/**
 * The one place every domain realtime subscription is mounted. Lives inside
 * AppShell so it starts as soon as an authenticated session exists and tears
 * every channel down on logout/unmount — one central layer instead of each
 * page opening its own websocket listeners (which would mean duplicate
 * subscriptions to the same table every time two pages both needed it).
 *
 * Notifications already had its own working subscription (useNotifications)
 * before this file existed, so it isn't duplicated here.
 *
 * Renders nothing — it's a hook-holder, not UI.
 */
export function RealtimeSync() {
  useJobsRealtime();
  useJournalRealtime();
  useFriendRealtime();
  useGroupsRealtime();
  useGoalsRealtime();
  return null;
}
