import * as React from "react";
import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCelebration } from "@/components/ambient/Celebration";
import { cn } from "@/lib/utils";

function encouragement(count: number, goal: number): string {
  if (goal <= 0) return "Set a weekly goal in Settings whenever you're ready — no pressure.";
  if (count === 0) return "Nothing sent in this goal cycle yet. Whenever you're ready — one is enough to start.";
  if (count >= goal) return `${count} of ${goal} in this cycle — you've hit your goal. However the rest of the week goes, this counts.`;
  const remaining = goal - count;
  return `${count} of ${goal} in this cycle — ${remaining} more gets you there.`;
}

export function GoalProgress({
  applicationsInCycle,
  weeklyGoal,
  streak,
  onCycleComplete,
}: {
  applicationsInCycle: number;
  weeklyGoal: number;
  streak: number;
  onCycleComplete: (startedAt: string) => void;
}) {
  const { celebrate } = useCelebration();
  const pct = weeklyGoal > 0 ? Math.min(100, Math.round((applicationsInCycle / weeklyGoal) * 100)) : 0;
  const complete = weeklyGoal > 0 && applicationsInCycle >= weeklyGoal;

  // Tracks whether we've already celebrated this week's goal, seeded from
  // the current state so a page load that's already complete (yesterday's
  // achievement, a refresh) doesn't re-trigger it — only the transition
  // into "complete" during this session does.
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
    <Card className={cn("glass-subtle border-border/60 transition-shadow", complete && "motion-safe:animate-ring-glow")}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Current goal cycle</p>
          {streak > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold">
              <Flame className="h-3.5 w-3.5" /> {streak}-day streak
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{encouragement(applicationsInCycle, weeklyGoal)}</p>
        <Progress value={pct} className="mt-4" />
      </CardContent>
    </Card>
  );
}
