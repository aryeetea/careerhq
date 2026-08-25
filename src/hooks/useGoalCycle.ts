import * as React from "react";
import { useUpdateProfile } from "@/hooks/queries/useProfile";
import { getGoalCycleApplicationCount } from "@/lib/stats";
import type { Job, Profile } from "@/types/database";

/**
 * Single source of truth for the weekly-goal "cycle" — the window that
 * resets only once a completed goal has been celebrated, rather than on
 * a fixed calendar boundary. Backed by profile.weekly_goal_cycle_started_at
 * (durable, cross-device) with a localStorage mirror so a just-completed
 * cycle never flashes back to "still in progress" while the account update
 * is in flight.
 *
 * Every surface that shows weekly-goal progress (Dashboard, Profile) reads
 * and advances this same cycle, so the count and the completion moment
 * agree everywhere instead of drifting apart.
 */
export function useGoalCycle(profile: Profile | null | undefined, jobs: Job[], applicationsThisWeek: number) {
  const updateProfile = useUpdateProfile();
  const goalCycleStorageKey = profile ? `bloom:weekly-goal-cycle:${profile.id}` : null;
  const [localGoalCycleStartedAt, setLocalGoalCycleStartedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!goalCycleStorageKey) {
      setLocalGoalCycleStartedAt(null);
      return;
    }
    setLocalGoalCycleStartedAt(window.localStorage.getItem(goalCycleStorageKey));
  }, [goalCycleStorageKey]);

  // Prefer the newest marker so an immediate local reset is never undone
  // while the account-level update is still in flight.
  const goalCycleStartedAt = React.useMemo(() => {
    const candidates = [profile?.weekly_goal_cycle_started_at, localGoalCycleStartedAt].filter(
      (value): value is string => typeof value === "string" && !Number.isNaN(new Date(value).getTime())
    );
    return candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  }, [localGoalCycleStartedAt, profile?.weekly_goal_cycle_started_at]);

  const persistGoalCycleStart = React.useCallback(
    (startedAt: string) => {
      setLocalGoalCycleStartedAt(startedAt);
      if (goalCycleStorageKey) window.localStorage.setItem(goalCycleStorageKey, startedAt);
      updateProfile.mutate({ weekly_goal_cycle_started_at: startedAt });
    },
    [goalCycleStorageKey, updateProfile]
  );

  const applicationsInCycle = React.useMemo(
    () => getGoalCycleApplicationCount(jobs, goalCycleStartedAt),
    [goalCycleStartedAt, jobs]
  );

  const migratedGoalCycleRef = React.useRef<string | null>(null);

  // Existing completed goals were celebrated before a durable cycle marker
  // existed. Mark that first boundary once so they start a fresh cycle too.
  React.useEffect(() => {
    if (!profile || profile.weekly_goal_cycle_started_at || profile.weekly_application_goal <= 0) return;
    if (applicationsThisWeek < profile.weekly_application_goal || migratedGoalCycleRef.current === profile.id) return;
    migratedGoalCycleRef.current = profile.id;
    persistGoalCycleStart(new Date().toISOString());
  }, [persistGoalCycleStart, profile, applicationsThisWeek]);

  return { applicationsInCycle, onCycleComplete: persistGoalCycleStart };
}
