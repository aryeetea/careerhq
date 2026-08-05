import * as React from "react";
import { Link } from "react-router-dom";
import { CalendarClock, MapPin, Pencil, Sparkles, UserRound } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ThoughtBubble } from "@/components/shared/ThoughtBubble";
import { CareerGoalCard } from "@/components/profile/CareerGoalCard";
import { WeeklyProgressCard } from "@/components/profile/WeeklyProgressCard";
import { SearchHealthCard } from "@/components/profile/SearchHealthCard";
import { BloomGarden } from "@/components/profile/BloomGarden";
import { RecentActivityFeed } from "@/components/profile/RecentActivityFeed";
import { FriendPreviewCard } from "@/components/profile/FriendPreviewCard";
import { StatusBadge } from "@/components/jobs/StatusBadge";
import { useProfile } from "@/hooks/queries/useProfile";
import { useJobs } from "@/hooks/queries/useJobs";
import { useResumes } from "@/hooks/queries/useResumes";
import { useGoals } from "@/hooks/queries/useGoals";
import { useRecentActivity } from "@/hooks/queries/useActivity";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { computeDashboardStats, getUpcomingInterviews } from "@/lib/stats";
import { computeGardenStages } from "@/lib/garden";
import { initials } from "@/lib/utils";

export default function ProfilePage() {
  const { data: profile } = useProfile();
  const { data: jobs = [] } = useJobs();
  const { data: resumes = [] } = useResumes();
  const { data: goals = [] } = useGoals();
  const { data: activity = [] } = useRecentActivity();
  const avatarUrl = useSignedAvatarUrl(profile?.avatar_url ?? null);

  const stats = React.useMemo(() => computeDashboardStats(jobs), [jobs]);
  const gardenStages = React.useMemo(
    () => (profile ? computeGardenStages(jobs, resumes, profile.created_at) : []),
    [jobs, resumes, profile]
  );
  const recentAchievements = React.useMemo(
    () =>
      gardenStages
        .filter((s) => s.unlocked && s.key !== "account_created")
        .sort((a, b) => new Date(b.unlockedAt ?? 0).getTime() - new Date(a.unlockedAt ?? 0).getTime())
        .slice(0, 2),
    [gardenStages]
  );
  const upcomingInterviews = React.useMemo(() => getUpcomingInterviews(jobs, 3), [jobs]);

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Profile" subtitle="How Bloom knows and represents you" />
        <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
          <EmptyState
            icon={<UserRound className="h-5 w-5" />}
            title="Your profile is still taking shape"
            description="Finish onboarding first, then your profile will live here with your preferences, sharing settings, and account snapshot."
            action={
              <Button asChild>
                <Link to="/onboarding">Finish onboarding</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Profile"
        subtitle="A living snapshot of you and your search"
        action={
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/app/settings">
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Edit profile</span>
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        <div className="grid gap-4">
          {/* Identity: avatar, stable professional bio, and today's reflection — kept
              visually distinct so they never read as the same field. */}
          <Card className="glass-subtle border-border/60">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 border border-border/80 shadow-soft">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                    <AvatarFallback className="text-lg">{initials(profile.display_name || "You")}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 sm:hidden">
                    <h2 className="truncate font-display text-2xl font-semibold">{profile.display_name}</h2>
                    <p className="truncate text-sm text-foreground/68">@{profile.username}</p>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="hidden sm:block">
                    <h2 className="truncate font-display text-2xl font-semibold">{profile.display_name}</h2>
                    <p className="truncate text-sm text-foreground/68">@{profile.username}</p>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-foreground/82">
                    {profile.bio || (
                      <span className="text-muted-foreground">
                        Add a one-line professional intro in{" "}
                        <Link to="/app/settings" className="font-medium text-primary hover:underline">
                          Settings
                        </Link>
                        .
                      </span>
                    )}
                  </p>

                  <div className="mt-3 max-w-lg">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
                    {profile.status_message ? (
                      <ThoughtBubble tone="accent">
                        <p className="text-sm leading-6 text-foreground/82">{profile.status_message}</p>
                      </ThoughtBubble>
                    ) : (
                      <ThoughtBubble>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Nothing jotted down today — add a quick thought whenever you like.
                        </p>
                      </ThoughtBubble>
                    )}
                  </div>
                </div>
              </div>

              {(profile.primary_job_titles.length > 0 || profile.preferred_locations.length > 0) && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <InfoCard
                    icon={<Sparkles className="h-4 w-4 text-sage" />}
                    label="Target roles"
                    value={profile.primary_job_titles.length > 0 ? profile.primary_job_titles.join(", ") : "No target roles yet"}
                  />
                  <InfoCard
                    icon={<MapPin className="h-4 w-4 text-lavender" />}
                    label="Preferred locations"
                    value={profile.preferred_locations.length > 0 ? profile.preferred_locations.join(", ") : "No preferred locations yet"}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <CareerGoalCard profile={profile} goals={goals} />
            <WeeklyProgressCard stats={stats} weeklyGoal={profile.weekly_application_goal} />
            <SearchHealthCard profile={profile} resumes={resumes} jobs={jobs} goals={goals} />
          </div>

          <BloomGarden jobs={jobs} resumes={resumes} accountCreatedAt={profile.created_at} />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="grid gap-4 lg:col-span-2">
              <RecentActivityFeed activity={activity} />
              <AchievementsAndInterviewsCard
                achievements={recentAchievements}
                upcomingInterviews={upcomingInterviews.map((j) => ({ id: j.id, title: j.title, company: j.company, date: j.interview_date!, status: j.status }))}
              />
            </div>
            <FriendPreviewCard
              profile={profile}
              avatarUrl={avatarUrl}
              currentStreak={stats.currentStreak}
              applicationsThisWeek={stats.applicationsThisWeek}
              mostRecentAchievement={recentAchievements[0] ?? null}
              sharedGoals={goals.filter((g) => g.owner_id === profile.id && g.is_shared)}
              latestActivity={activity[0] ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </div>
      <p className="text-sm leading-6 text-foreground/78">{value}</p>
    </div>
  );
}

// Replaces the old "Privacy and account overview" card — that information
// already lives in Settings. This surfaces things that keep being useful:
// what you've recently unlocked in the garden, and what's coming up.
function AchievementsAndInterviewsCard({
  achievements,
  upcomingInterviews,
}: {
  achievements: { key: string; emoji: string; label: string; description: string }[];
  upcomingInterviews: { id: string; title: string; company: string; date: string; status: import("@/types/database").JobStatus }[];
}) {
  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 font-semibold">Recent achievements</h3>
          {achievements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your next Bloom Garden milestone will show up here.</p>
          ) : (
            <ul className="grid gap-2">
              {achievements.map((a) => (
                <li key={a.key} className="flex items-center gap-2 text-sm">
                  <span className="text-lg">{a.emoji}</span> {a.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-3 flex items-center gap-1.5 font-semibold">
            <CalendarClock className="h-4 w-4 text-gold" /> Upcoming interviews
          </h3>
          {upcomingInterviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing on the calendar right now.</p>
          ) : (
            <ul className="grid gap-2">
              {upcomingInterviews.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {j.title} <span className="text-muted-foreground">· {j.company}</span>
                  </span>
                  <StatusBadge status={j.status} className="shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
