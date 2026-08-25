import * as React from "react";
import { Link } from "react-router-dom";
import { MapPin, Pencil, Sparkles, Target, UserRound } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageContent, PageContainer } from "@/components/layout/PageContent";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { QuickThoughtEditor } from "@/components/profile/QuickThoughtEditor";
import { DailyEncouragement } from "@/components/shared/DailyEncouragement";
import { CareerGoalCard } from "@/components/profile/CareerGoalCard";
import { SkillsRow } from "@/components/profile/SkillsRow";
import { ProgressSection } from "@/components/profile/ProgressSection";
import { useProfile } from "@/hooks/queries/useProfile";
import { useJobs } from "@/hooks/queries/useJobs";
import { useResumes } from "@/hooks/queries/useResumes";
import { useGoals } from "@/hooks/queries/useGoals";
import { useRecentActivity } from "@/hooks/queries/useActivity";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { useGoalCycle } from "@/hooks/useGoalCycle";
import { computeDashboardStats } from "@/lib/stats";
import { getPersonProfilePath } from "@/lib/people";
import { initials } from "@/lib/utils";

// Five sections, each answering one question, nothing more:
// Hero (who you are), Today's Thought (how you're doing right now),
// Career (what you're working toward), Skills, and Progress (how it's
// going). Everything here used to be its own bordered card — this page
// leans on whitespace and typography to group things instead.
export default function ProfilePage() {
  const { data: profile } = useProfile();
  const { data: jobs = [] } = useJobs();
  const { data: resumes = [] } = useResumes();
  const { data: goals = [] } = useGoals();
  const { data: activity = [] } = useRecentActivity();
  const avatarUrl = useSignedAvatarUrl(profile?.avatar_url ?? null);

  const stats = React.useMemo(() => computeDashboardStats(jobs), [jobs]);
  const { applicationsInCycle, onCycleComplete } = useGoalCycle(profile, jobs, stats.applicationsThisWeek);

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Profile" subtitle="A space to share who you are and what you're working toward." />
        <PageContent>
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
        </PageContent>
      </div>
    );
  }

  const hasCareerContent = Boolean(profile.career_goal) || profile.primary_job_titles.length > 0 || profile.preferred_locations.length > 0;

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

      <PageContent className="pb-16">
        <PageContainer className="max-w-3xl">
          <div className="grid gap-10 lg:gap-12">
            {/* 1. Hero — no card, just space and hierarchy. */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <Avatar className="h-24 w-24 shrink-0 border border-border/80 shadow-soft">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                <AvatarFallback className="text-xl">{initials(profile.display_name || "You")}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-3xl font-semibold">{profile.display_name}</h1>
                <p className="truncate text-sm text-foreground/60">@{profile.username}</p>

                <p className="mt-3 max-w-xl text-[15px] leading-7 text-foreground/82">
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

                <Link
                  to={getPersonProfilePath(profile.id, { preview: "friend" })}
                  className="mt-3 inline-block text-xs font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                >
                  See how this looks to a friend
                </Link>
              </div>
            </div>

            {/* 2. Today's Thought — the one card on this page meant to feel like a card. */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today's thought</p>
              <QuickThoughtEditor value={profile.status_message} />
              <div className="mt-2.5">
                <DailyEncouragement variant="profile" />
              </div>
            </div>

            <div>
              {/* 3. Career — goal, target roles, and locations as one story. */}
              {hasCareerContent && (
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-tight">Career</h2>
                  <div className="mt-3">
                    <CareerGoalCard profile={profile} goals={goals} />
                  </div>
                  {(profile.primary_job_titles.length > 0 || profile.preferred_locations.length > 0) && (
                    <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                      {profile.primary_job_titles.length > 0 && (
                        <p className="flex items-start gap-2 leading-6">
                          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
                          <span>
                            <span className="text-muted-foreground">Targeting </span>
                            {profile.primary_job_titles.join(", ")}
                          </span>
                        </p>
                      )}
                      {profile.preferred_locations.length > 0 && (
                        <p className="flex items-start gap-2 leading-6">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lavender" />
                          <span>
                            <span className="text-muted-foreground">Open to </span>
                            {profile.preferred_locations.join(", ")}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. Skills */}
            {profile.skills.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">Skills</h2>
                <div className="mt-3">
                  <SkillsRow skills={profile.skills} />
                </div>
              </div>
            )}

            {/* 5. Progress — Weekly Progress + Search Health + Bloom Garden + a recap, merged. */}
            <ProgressSection
              stats={stats}
              weeklyGoal={profile.weekly_application_goal}
              applicationsInCycle={applicationsInCycle}
              onCycleComplete={onCycleComplete}
              profile={profile}
              resumes={resumes}
              jobs={jobs}
              goals={goals}
              activity={activity}
            />
          </div>
        </PageContainer>
      </PageContent>
    </div>
  );
}
