import { Link } from "react-router-dom";
import { CalendarDays, Compass, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { getMyActiveGoals, pickCurrentGoal } from "@/lib/goals";
import type { GoalWithMembers } from "@/services/goals";
import type { Profile } from "@/types/database";

export function CareerGoalCard({ profile, goals }: { profile: Profile; goals: GoalWithMembers[] }) {
  const activeGoals = getMyActiveGoals(goals, profile.id);
  const currentGoal = pickCurrentGoal(activeGoals);
  const member = currentGoal?.goal_members.find((m) => m.user_id === profile.id);
  const progress = member ? Math.min(100, Math.round((member.progress_count / currentGoal!.target_count) * 100)) : 0;

  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Career goal</h3>
        </div>

        {!profile.career_goal ? (
          <div className="py-2">
            <p className="text-sm leading-6 text-muted-foreground">
              You haven&apos;t set a career goal yet. A short north star helps Bloom (and you) know what "on track" looks like.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link to="/app/settings">Add a career goal</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-sm leading-6 text-foreground/85">{profile.career_goal}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Started {formatDate(profile.onboarded_at ?? profile.created_at)}
            </p>

            {currentGoal ? (
              <div className="rounded-2xl border border-border/70 bg-card/70 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Compass className="h-3.5 w-3.5" /> Current milestone
                  </p>
                  {currentGoal.deadline && (
                    <span className="text-xs text-muted-foreground">By {formatDate(currentGoal.deadline)}</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm font-medium">{currentGoal.name}</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <Progress value={progress} className="h-1.5" />
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {member?.progress_count ?? 0}/{currentGoal.target_count}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 p-3.5 text-center">
                <p className="text-xs text-muted-foreground">No active milestone yet.</p>
                <Button asChild variant="link" size="sm">
                  <Link to="/app/goals">Set one for this goal</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
