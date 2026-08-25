import * as React from "react";
import { Flame, TrendingUp, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useCelebration } from "@/components/ambient/Celebration";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/stats";

function nextMilestone(applicationsInCycle: number, weeklyGoal: number): string {
  if (weeklyGoal <= 0) return "Set a weekly goal in Settings whenever you're ready — no pressure.";
  if (applicationsInCycle >= weeklyGoal) return "Goal hit — keep the streak alive if it feels good, or rest. Both count.";
  const remaining = weeklyGoal - applicationsInCycle;
  return `${remaining} more application${remaining === 1 ? "" : "s"} to hit your weekly goal.`;
}

// Content only, no outer card — the first third of the merged Progress
// section (see ProgressSection.tsx).
//
// applicationsInCycle/onCycleComplete come from the same useGoalCycle
// hook the Dashboard uses, so this card and the Dashboard's goal card
// always agree on both the count and the moment the goal is hit —
// including firing the same celebration, not just a glow.
export function WeeklyProgressCard({
  stats,
  weeklyGoal,
  applicationsInCycle,
  onCycleComplete,
}: {
  stats: DashboardStats;
  weeklyGoal: number;
  applicationsInCycle: number;
  onCycleComplete: (startedAt: string) => void;
}) {
  const { celebrate } = useCelebration();
  const pct = weeklyGoal > 0 ? Math.min(100, Math.round((applicationsInCycle / weeklyGoal) * 100)) : 0;
  const complete = weeklyGoal > 0 && applicationsInCycle >= weeklyGoal;

  // Same transition-only guard as GoalProgress: seeded from the current
  // state so an already-complete cycle on mount (e.g. arriving here right
  // after celebrating on the Dashboard) doesn't fire a second time.
  const hasCelebratedRef = React.useRef(complete);
  React.useEffect(() => {
    if (complete && !hasCelebratedRef.current) {
      hasCelebratedRef.current = true;
      const nextCycleStartedAt = new Date().toISOString();
      celebrate(`Weekly goal hit — ${applicationsInCycle} of ${weeklyGoal}! 🎉`, {
        onComplete: () => onCycleComplete(nextCycleStartedAt),
      });
    } else if (!complete) {
      hasCelebratedRef.current = false;
    }
  }, [applicationsInCycle, complete, celebrate, onCycleComplete, weeklyGoal]);

  return (
    <div className={cn(complete && "motion-safe:animate-ring-glow rounded-2xl")}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Current goal cycle</p>
        {stats.currentStreak > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold">
            <Flame className="h-3.5 w-3.5" /> {stats.currentStreak}-day streak
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Applications in this cycle</span>
        <span className="font-semibold">
          {applicationsInCycle}
          {weeklyGoal > 0 ? ` / ${weeklyGoal}` : ""}
        </span>
      </div>
      <Progress value={pct} className="mt-2" />
      <p className="mt-2.5 text-xs leading-5 text-muted-foreground">{nextMilestone(applicationsInCycle, weeklyGoal)}</p>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-card/60 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Interviews booked
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{stats.interviews}</p>
        </div>
        <div className="rounded-xl bg-card/60 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Response rate
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{stats.responseRate}%</p>
        </div>
      </div>
    </div>
  );
}
