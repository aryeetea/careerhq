import { Award, Bookmark, GraduationCap, PartyPopper, Send, Sparkles, Target, Trophy, Users, type LucideIcon } from "lucide-react";
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
  goal_completed: PartyPopper,
  onboarding_completed: Sparkles,
};

// Content only, no outer card — a short recap folded into the bottom of
// the Progress section rather than a whole separate feed. `limit` keeps it
// to a glance, not a scroll.
export function RecentActivityFeed({ activity, limit = 4 }: { activity: ProfileActivity[]; limit?: number }) {
  if (activity.length === 0) return null;
  const items = activity.slice(0, limit);

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Lately</p>
      <ul className="grid gap-1">
        {items.map((item) => {
          const Icon = ACTIVITY_ICONS[item.type] ?? Sparkles;
          return (
            <li key={item.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground/85">{item.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.created_at)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
