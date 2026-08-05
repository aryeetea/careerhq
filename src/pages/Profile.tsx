import * as React from "react";
import { Link } from "react-router-dom";
import { CalendarClock, MapPin, Pencil, Sparkles, Target, UserRound } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { QuickThoughtEditor } from "@/components/profile/QuickThoughtEditor";
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
        <TopBar title="Profile" subtitle="A space to share who you are and what you're working toward." />
        <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
          <EmptyState
            icon={<UserRound className="h-5 w-5" />}
            title="Your profile is still taking shape"
            description="Finish onboarding and this space will be ready for your story, your goals, and the parts of your search you want to share."
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
        subtitle="A place to share who you are and what this season looks like for you."
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
                        Add a few words about yourself in{" "}
                        <Link to="/app/settings" className="font-medium text-primary hover:underline">
                          Settings
                        </Link>
                        .
                      </span>
                    )}
                  </p>

                  {profile.career_status && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">
                      <Target className="h-3.5 w-3.5 shrink-0" /> {profile.career_status}
                    </p>
                  )}

                  <div className="mt-3 max-w-lg">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today's thought</p>
                    <QuickThoughtEditor value={profile.status_message} />
                  </div>
                </div>
              </div>

              {profile.skills.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {profile.skills.map((skill) => (
                    <Chip key={skill} variant="neutral">{skill}</Chip>
                  ))}
                </div>
              )}

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
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {tokens.map((token) => (
          <Chip key={token} variant="interactive">{token}</Chip>
        ))}
      </div>
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
  achievements: { key: string; growthLabel: string; milestoneLabel: string; description: string }[];
  upcomingInterviews: { id: string; title: string; company: string; date: string; status: import("@/types/database").JobStatus }[];
}) {
  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 font-semibold">Recent achievements</h3>
          {achievements.length === 0 ? (
            <p className="text-sm text-muted-foreground">When you reach something worth celebrating, it will show up here.</p>
          ) : (
            <ul className="grid gap-2">
              {achievements.map((a) => (
                <li key={a.key} className="rounded-2xl border border-border/60 bg-card/55 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">{a.growthLabel}</p>
                  <p className="mt-0.5 text-sm font-medium">{a.milestoneLabel}</p>
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
            <p className="text-sm text-muted-foreground">Nothing scheduled right now.</p>
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
