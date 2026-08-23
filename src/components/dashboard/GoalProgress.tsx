import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function encouragement(count: number, goal: number): string {
  if (goal <= 0) return "Set a weekly goal in Settings whenever you're ready — no pressure.";
  if (count === 0) return "Nothing sent yet this week. Whenever you're ready — one is enough to start.";
  if (count >= goal) return `${count} of ${goal} this week — you've hit your goal. However the rest of the week goes, this counts.`;
  const remaining = goal - count;
  return `${count} of ${goal} this week — ${remaining} more gets you there.`;
}

export function GoalProgress({ applicationsThisWeek, weeklyGoal, streak }: { applicationsThisWeek: number; weeklyGoal: number; streak: number }) {
  const pct = weeklyGoal > 0 ? Math.min(100, Math.round((applicationsThisWeek / weeklyGoal) * 100)) : 0;
  const complete = weeklyGoal > 0 && applicationsThisWeek >= weeklyGoal;

  return (
    <Card className={cn("glass-subtle border-border/60 transition-shadow", complete && "motion-safe:animate-ring-glow")}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">This week's goal</p>
          {streak > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold">
              <Flame className="h-3.5 w-3.5" /> {streak}-day streak
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{encouragement(applicationsThisWeek, weeklyGoal)}</p>
        <Progress value={pct} className="mt-4" />
      </CardContent>
    </Card>
  );
}
