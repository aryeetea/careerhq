import { Award, Bookmark, GraduationCap, Send, Sparkles, Target, Trophy, Users, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";
import type { ProfileActivity, ProfileActivityType } from "@/types/database";

const ACTIVITY_ICONS: Record<ProfileActivityType, LucideIcon> = {
  job_saved: Bookmark,
  job_applied: Send,
  interview_scheduled: Users,
  offer_received: Trophy,
  ai_analysis_run: Sparkles,
  resume_uploaded: Bookmark,
  certification_added: GraduationCap,
  certification_completed: Award,
  goal_created: Target,
  onboarding_completed: Sparkles,
};

export function RecentActivityFeed({ activity }: { activity: ProfileActivity[] }) {
  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="p-5">
        <h3 className="mb-3 font-semibold">Recent activity</h3>
        {activity.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing yet — your first save will show up here.</p>
        ) : (
          <ul className="grid gap-1">
            {activity.map((item) => {
              const Icon = ACTIVITY_ICONS[item.type] ?? Sparkles;
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
