import { Flame, Heart, Sparkles, Target, Users2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import type { GardenStage } from "@/lib/garden";
import type { GoalWithMembers } from "@/services/goals";
import type { Profile, ProfileActivity } from "@/types/database";

export function FriendPreviewCard({
  profile,
  avatarUrl,
  currentStreak,
  applicationsThisWeek,
  mostRecentAchievement,
  sharedGoals,
  latestActivity,
}: {
  profile: Profile;
  avatarUrl: string | null;
  currentStreak: number;
  applicationsThisWeek: number;
  mostRecentAchievement: GardenStage | null;
  sharedGoals: GoalWithMembers[];
  latestActivity: ProfileActivity | null;
}) {
  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users2 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Friend preview</h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">This is roughly what friends see on your card.</p>

        <div className="rounded-[1.75rem] border border-border/70 bg-card/80 p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 border border-border">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback>{initials(profile.display_name || "You")}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile.display_name}</p>
              <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
            </div>
          </div>

          {profile.career_goal && (
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-foreground/78">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {profile.career_goal}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span>{applicationsThisWeek} applications this week</span>
            {currentStreak > 0 && (
              <span className="flex items-center gap-1 text-gold">
                <Flame className="h-3 w-3" /> {currentStreak}-day streak
              </span>
            )}
          </div>

          {mostRecentAchievement && (
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-foreground/78">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Recently: {mostRecentAchievement.growthLabel} · {mostRecentAchievement.milestoneLabel}
            </p>
          )}

          {sharedGoals.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Sharing {sharedGoals.length} goal{sharedGoals.length === 1 ? "" : "s"}: {sharedGoals.map((g) => g.name).join(", ")}
            </p>
          )}

          {latestActivity && <p className="mt-2 text-xs text-muted-foreground">Last activity: {latestActivity.title}</p>}

          <Button type="button" size="sm" variant="outline" disabled className="mt-3.5 w-full gap-1.5">
            <Heart className="h-3.5 w-3.5" /> Send encouragement
          </Button>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            This is the button friends use to send encouragement.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
