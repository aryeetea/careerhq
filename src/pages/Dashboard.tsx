import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Send, Bookmark, Users, Trophy, XCircle, TrendingUp, CalendarCheck2, Plus, Sparkles, GraduationCap, CalendarClock, AlertTriangle } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageContent, PageContainer } from "@/components/layout/PageContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { GoalProgress } from "@/components/dashboard/GoalProgress";
import { DailyEncouragement } from "@/components/shared/DailyEncouragement";
import { MiniBarChart } from "@/components/dashboard/MiniBarChart";
import { UpcomingList, type UpcomingRow } from "@/components/dashboard/UpcomingList";
import { AddJobDialog } from "@/components/jobs/AddJobDialog";
import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";
import { StatusBadge } from "@/components/jobs/StatusBadge";
import { FollowUpCheckmark } from "@/components/jobs/FollowUpCheckmark";
import { useJobs } from "@/hooks/queries/useJobs";
import { useResumes } from "@/hooks/queries/useResumes";
import { useCertifications } from "@/hooks/queries/useCertifications";
import { useProfile, useUpdateProfile } from "@/hooks/queries/useProfile";
import { useCandidateFacts } from "@/hooks/queries/useCandidateFacts";
import { computeDashboardStats, getGoalCycleApplicationCount, getUpcomingInterviews } from "@/lib/stats";
import { jobNeedsRequirementConfirmation } from "@/lib/jobRequirements";
import { CERTIFICATION_STATUS_META } from "@/lib/constants";
import type { Job } from "@/types/database";

export default function Dashboard() {
  const { data: jobs = [], isLoading, isError, refetch } = useJobs();
  const { data: resumes = [] } = useResumes();
  const { data: certifications = [] } = useCertifications();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: candidateFacts } = useCandidateFacts();
  const navigate = useNavigate();

  const [addOpen, setAddOpen] = React.useState(false);
  // Holds only the id, not the job object — the object is derived fresh
  // from `jobs` below on every render. Keeping the whole object in state
  // used to need a separate effect to re-sync it whenever `jobs` changed
  // (a cover letter generated, a follow-up completed, a realtime update
  // from another tab), and that effect's own setState could race the one
  // Save/Cancel uses to close the dialog — closing it would occasionally
  // get silently reopened a beat later. Deriving from the id removes the
  // second copy of truth, and the race along with it.
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
  const selectedJob = React.useMemo(() => jobs.find((j) => j.id === selectedJobId) ?? null, [jobs, selectedJobId]);
  const setSelectedJob = React.useCallback((job: Job) => setSelectedJobId(job.id), []);

  const stats = React.useMemo(() => computeDashboardStats(jobs), [jobs]);
  const applicationsInGoalCycle = React.useMemo(
    () => getGoalCycleApplicationCount(jobs, profile?.weekly_goal_cycle_started_at ?? null),
    [jobs, profile?.weekly_goal_cycle_started_at]
  );
  const migratedGoalCycleRef = React.useRef<string | null>(null);

  // Existing completed goals were celebrated before a durable cycle marker
  // existed. Mark that first boundary once so they start a fresh cycle too.
  React.useEffect(() => {
    if (!profile || profile.weekly_goal_cycle_started_at || profile.weekly_application_goal <= 0) return;
    if (stats.applicationsThisWeek < profile.weekly_application_goal || migratedGoalCycleRef.current === profile.id) return;
    migratedGoalCycleRef.current = profile.id;
    updateProfile.mutate({ weekly_goal_cycle_started_at: new Date().toISOString() });
  }, [profile, stats.applicationsThisWeek, updateProfile]);

  const handleGoalCycleComplete = React.useCallback(
    (startedAt: string) => updateProfile.mutate({ weekly_goal_cycle_started_at: startedAt }),
    [updateProfile]
  );

  const upcomingFollowUps: UpcomingRow[] = React.useMemo(() => {
    // Compares calendar-date strings directly rather than epoch
    // timestamps — follow_up_date is a plain "YYYY-MM-DD" with no time
    // component, and parsing it with `new Date(...)` reads it as UTC
    // midnight. Subtracting a raw 24h from `Date.now()` to build a "still
    // show yesterday's" grace window then compares that UTC-midnight
    // timestamp against local now, which silently drops a follow-up dated
    // "yesterday" hours before the local day is actually over. Date-only
    // string comparison sidesteps timezone parsing entirely.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
    return jobs
      .filter((j) => j.follow_up_date && j.follow_up_date.slice(0, 10) >= cutoffKey)
      .sort((a, b) => a.follow_up_date!.localeCompare(b.follow_up_date!))
      .slice(0, 5)
      .map((j) => ({
        id: j.id,
        title: j.title,
        subtitle: j.company,
        date: j.follow_up_date!,
        onClick: () => setSelectedJob(j),
        action: <FollowUpCheckmark job={j} />,
      }));
  }, [jobs]);

  const upcomingInterviews: UpcomingRow[] = React.useMemo(() => {
    return getUpcomingInterviews(jobs, 5).map((j) => ({
      id: j.id,
      title: j.title,
      subtitle: j.company,
      date: j.interview_date!,
      onClick: () => setSelectedJob(j),
    }));
  }, [jobs]);

  const recent = React.useMemo(() => jobs.slice(0, 6), [jobs]);
  const activeCert = React.useMemo(() => certifications.find((c) => c.status === "in_progress"), [certifications]);
  const followUpsDue = React.useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return jobs.filter((job) => job.follow_up_date && job.follow_up_date.slice(0, 10) <= today).length;
  }, [jobs]);
  // Same predicate that drives each JobCard's own alert badge (see
  // getPendingRequirementConfirmations) — this count and every badge on
  // the board clear together the instant an answer is saved, since both
  // read off the same useCandidateFacts cache.
  const confirmedRequirementKeys = React.useMemo(
    () => new Set((candidateFacts ?? []).map((fact) => fact.requirement_key)),
    [candidateFacts]
  );
  const requirementsToConfirm = React.useMemo(
    () => jobs.filter((job) => jobNeedsRequirementConfirmation(job, confirmedRequirementKeys)).length,
    [jobs, confirmedRequirementKeys]
  );
  const hasUsefulResponseRate = stats.applicationsSubmitted >= 3;

  const hasJobs = jobs.length > 0;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Dashboard"
        subtitle="Your growth, at a glance"
        action={
          <Button data-tour="add-job-button" onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add job</span>
          </Button>
        }
      />

      <PageContent>
        <PageContainer>
        <div className="mb-4">
          <DailyEncouragement variant="dashboard" />
        </div>

        {isError ? (
          <ErrorState description="Your dashboard couldn't load. Your data is safe — try again." onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-2xl" />
            ))}
          </div>
        ) : !hasJobs ? (
          <div data-tour="dashboard-overview" className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
            <EmptyState
              className="glass-subtle border border-border/60"
              icon={<Sparkles className="h-5 w-5" />}
              title="Welcome — let's set up your board"
              description="Save the first role you're considering and Bloom will start growing your dashboard from here. One step at a time."
              action={
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" /> Add your first job
                </Button>
              }
            />

            <Card className="glass-subtle border-border/60">
              <CardContent className="p-5">
                <h3 className="font-display text-lg font-semibold">A gentle place to begin</h3>
                <p className="mt-1.5 text-sm leading-6 text-foreground/72">
                  The dashboard fills in as you add the first pieces of your search. These are the quickest steps that unlock the rest
                  of Bloom.
                </p>
                <div className="mt-5 grid gap-3">
                  <QuickStartLink
                    to="/app/profile"
                    title="Review your profile"
                    description="Make sure your goals, target roles, and sharing settings feel right."
                  />
                  <QuickStartLink
                    to="/app/resumes"
                    title="Upload a resume"
                    description="Bloom can recommend and compare resumes once at least one version is saved."
                  />
                  <QuickStartLink
                    to="/app/settings"
                    title="Set preferences"
                    description="Choose your theme, privacy defaults, and other calm-making details."
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div data-tour="dashboard-overview" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={Bookmark} label="Jobs saved" value={stats.jobsSaved} accent="bg-slate-400/15 text-slate-500" to="/app/dashboard/jobs-saved" />
              <StatCard icon={Send} label="Applications sent" value={stats.applicationsSubmitted} accent="bg-primary/15 text-primary" to="/app/dashboard/applications-sent" />
              <StatCard icon={Users} label="Interviews" value={stats.interviews} accent="bg-lavender/20 text-lavender-foreground" to="/app/dashboard/interviews" />
              <StatCard icon={Trophy} label="Offers" value={stats.offers} accent="bg-success/15 text-success" to="/app/dashboard/offers" />
              <StatCard icon={XCircle} label="Rejections" value={stats.rejections} accent="bg-destructive/15 text-destructive" to="/app/dashboard/rejections" />
              <StatCard icon={CalendarCheck2} label="Follow-ups due" value={followUpsDue} accent="bg-gold/15 text-gold" to="/app/dashboard/follow-ups-due" />
              <StatCard
                icon={AlertTriangle}
                label="Requirements to confirm"
                value={requirementsToConfirm}
                accent="bg-destructive/15 text-destructive"
                to="/app/dashboard/requirements-to-confirm"
              />
              <StatCard
                icon={TrendingUp}
                label="Response rate"
                value={hasUsefulResponseRate ? `${stats.responseRate}%` : "—"}
                accent="bg-sky/15 text-sky"
                to="/app/dashboard/response-rate"
              />
              <StatCard icon={CalendarClock} label="No response in 14 days" value={stats.noResponse} accent="bg-zinc-400/15 text-zinc-500" to="/app/dashboard/no-response" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <GoalProgress
                applicationsInCycle={applicationsInGoalCycle}
                weeklyGoal={profile?.weekly_application_goal ?? 0}
                streak={stats.currentStreak}
                onCycleComplete={handleGoalCycleComplete}
              />
              <Card className="glass-subtle border-border/60 lg:col-span-2">
                <CardContent className="p-5">
                  <p className="text-sm font-semibold">Applications in the last 7 days</p>
                  <div className="mt-4">
                    <MiniBarChart data={stats.last7Days} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <UpcomingList
                title="Upcoming follow-ups"
                rows={upcomingFollowUps}
                emptyMessage="Nothing on the horizon right now. Enjoy the quiet."
                icon={<CalendarClock className="h-4 w-4 text-gold" />}
              />
              <UpcomingList
                title="Upcoming interviews"
                rows={upcomingInterviews}
                emptyMessage="No interviews on the calendar yet."
                icon={<Users className="h-4 w-4 text-lavender" />}
              />
            </div>

            <div className={`mt-4 grid grid-cols-1 gap-4 ${activeCert ? "lg:grid-cols-2" : ""}`}>
              <Card className="glass-subtle border-border/60">
                <CardContent className="p-4">
                  <h3 className="mb-1 text-sm font-semibold">Recently added</h3>
                  {recent.length === 0 ? (
                    <p className="py-7 text-center text-sm text-muted-foreground">Nothing here yet.</p>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {recent.map((j) => (
                        <li key={j.id}>
                          <button onClick={() => setSelectedJob(j)} className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-sm hover:text-primary">
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{j.title}</span>
                              <span className="block truncate text-xs text-muted-foreground">{j.company}</span>
                            </span>
                            <StatusBadge status={j.status} className="shrink-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {activeCert && (
                <Card className="glass-subtle border-border/60">
                  <CardContent className="p-4">
                    <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                      <GraduationCap className="h-4 w-4 text-sage" /> Certification progress
                    </h3>
                    <div className="py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{activeCert.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CERTIFICATION_STATUS_META[activeCert.status].className}`}>
                          {activeCert.progress_percentage}%
                        </span>
                      </div>
                      {activeCert.provider && <p className="text-xs text-muted-foreground">{activeCert.provider}</p>}
                      <Progress value={activeCert.progress_percentage} className="mt-3" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
        </PageContainer>
      </PageContent>

      <AddJobDialog open={addOpen} onOpenChange={setAddOpen} resumes={resumes} />
      <JobDetailDialog job={selectedJob} resumes={resumes} open={Boolean(selectedJob)} onOpenChange={(open) => !open && setSelectedJobId(null)} />
    </div>
  );
}

function QuickStartLink({ to, title, description }: { to: string; title: string; description: string }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-left transition-colors hover:border-primary/25 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-foreground/68">{description}</p>
    </Link>
  );
}
