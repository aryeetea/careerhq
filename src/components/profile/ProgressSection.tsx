import { WeeklyProgressCard } from "@/components/profile/WeeklyProgressCard";
import { SearchHealthCard } from "@/components/profile/SearchHealthCard";
import { BloomGarden } from "@/components/profile/BloomGarden";
import { RecentActivityFeed } from "@/components/profile/RecentActivityFeed";
import type { DashboardStats } from "@/lib/stats";
import type { Job, ProfileActivity, Resume } from "@/types/database";
import type { GoalWithMembers } from "@/services/goals";
import type { Profile } from "@/types/database";

// Weekly Progress, Search Health, and Bloom Garden used to be three
// separate cards in a row — all three are really the same idea (how is
// your search growing?) told at different zoom levels, so they're one
// section now: a single soft surface, generous internal spacing, and
// typographic sub-headers instead of nested card borders.
export function ProgressSection({
  stats,
  weeklyGoal,
  profile,
  resumes,
  jobs,
  goals,
  activity,
}: {
  stats: DashboardStats;
  weeklyGoal: number;
  profile: Profile;
  resumes: Resume[];
  jobs: Job[];
  goals: GoalWithMembers[];
  activity: ProfileActivity[];
}) {
  return (
    <section className="rounded-[2rem] border border-border/50 bg-card/40 px-5 py-6 sm:px-7 sm:py-8 lg:px-8 lg:py-10">
      <h2 className="font-display text-xl font-semibold tracking-tight">Progress</h2>
      <p className="mt-1 text-sm text-foreground/70">How your search is growing, all in one place.</p>

      <div className="mt-7 grid gap-8 lg:grid-cols-2">
        <WeeklyProgressCard stats={stats} weeklyGoal={weeklyGoal} />
        <SearchHealthCard profile={profile} resumes={resumes} jobs={jobs} goals={goals} />
      </div>

      <div className="mt-10 border-t border-border/50 pt-8 lg:mt-12 lg:pt-10">
        <BloomGarden jobs={jobs} resumes={resumes} accountCreatedAt={profile.created_at} />
      </div>

      {activity.length > 0 && (
        <div className="mt-10 border-t border-border/50 pt-8">
          <RecentActivityFeed activity={activity} limit={4} />
        </div>
      )}
    </section>
  );
}
