import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Send, Bookmark, Users, Trophy, XCircle, Ghost, TrendingUp, CalendarDays, Plus, Sparkles, GraduationCap, CalendarClock } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { GoalProgress } from "@/components/dashboard/GoalProgress";
import { MiniBarChart } from "@/components/dashboard/MiniBarChart";
import { UpcomingList, type UpcomingRow } from "@/components/dashboard/UpcomingList";
import { AddJobDialog } from "@/components/jobs/AddJobDialog";
import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";
import { StatusBadge } from "@/components/jobs/StatusBadge";
import { useJobs } from "@/hooks/queries/useJobs";
import { useResumes } from "@/hooks/queries/useResumes";
import { useCertifications } from "@/hooks/queries/useCertifications";
import { useProfile } from "@/hooks/queries/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { computeDashboardStats, getUpcomingInterviews } from "@/lib/stats";
import { CERTIFICATION_STATUS_META } from "@/lib/constants";
import type { Job } from "@/types/database";
import { WelcomeTutorialDialog } from "@/components/shared/WelcomeTutorialDialog";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: jobs = [], isLoading, isError, refetch } = useJobs();
  const { data: resumes = [] } = useResumes();
  const { data: certifications = [] } = useCertifications();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  const [addOpen, setAddOpen] = React.useState(false);
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const [tutorialOpen, setTutorialOpen] = React.useState(false);

  React.useEffect(() => {
    if (!user?.id || !profile?.onboarded_at) return;
    const seen = localStorage.getItem(`bloom-welcome-tour:v1:${user.id}`);
    if (!seen) setTutorialOpen(true);
  }, [profile?.onboarded_at, user?.id]);

  const stats = React.useMemo(() => computeDashboardStats(jobs), [jobs]);

  const upcomingFollowUps: UpcomingRow[] = React.useMemo(() => {
    const now = Date.now() - 86400000;
    return jobs
      .filter((j) => j.follow_up_date && new Date(j.follow_up_date).getTime() >= now)
      .sort((a, b) => new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime())
      .slice(0, 5)
      .map((j) => ({ id: j.id, title: j.title, subtitle: j.company, date: j.follow_up_date!, onClick: () => setSelectedJob(j) }));
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

  const hasJobs = jobs.length > 0;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Dashboard"
        subtitle="Your growth, at a glance"
        action={
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add job</span>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        {isError ? (
          <ErrorState description="Your dashboard couldn't load. Your data is safe — try again." onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-2xl" />
            ))}
          </div>
        ) : !hasJobs ? (
          <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={Bookmark} label="Jobs saved" value={stats.jobsSaved} accent="bg-slate-400/15 text-slate-500" />
              <StatCard icon={Send} label="Applications sent" value={stats.applicationsSubmitted} accent="bg-primary/15 text-primary" />
              <StatCard icon={Users} label="Interviews" value={stats.interviews} accent="bg-lavender/20 text-lavender-foreground" />
              <StatCard icon={Trophy} label="Offers" value={stats.offers} accent="bg-success/15 text-success" />
              <StatCard icon={XCircle} label="Rejections" value={stats.rejections} accent="bg-destructive/15 text-destructive" />
              <StatCard icon={Ghost} label="Ghosted" value={stats.ghosted} accent="bg-zinc-400/15 text-zinc-500" />
              <StatCard icon={TrendingUp} label="Response rate" value={`${stats.responseRate}%`} accent="bg-gold/15 text-gold" />
              <StatCard icon={CalendarDays} label="This month" value={stats.applicationsThisMonth} accent="bg-sky/15 text-sky" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <GoalProgress
                applicationsThisWeek={stats.applicationsThisWeek}
                weeklyGoal={profile?.weekly_application_goal ?? 0}
                streak={stats.currentStreak}
              />
              <Card className="glass-subtle border-border/60 lg:col-span-2">
                <CardContent className="p-5">
                  <p className="text-sm font-semibold">Applications this week</p>
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

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
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

              <Card className="glass-subtle border-border/60">
                <CardContent className="p-4">
                  <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                    <GraduationCap className="h-4 w-4 text-sage" /> Certification progress
                  </h3>
                  {!activeCert ? (
                    <div className="py-6 text-center">
                      <p className="text-sm text-muted-foreground">Nothing in progress right now.</p>
                      <Button variant="link" size="sm" onClick={() => navigate("/app/certifications")}>
                        Add one to track
                      </Button>
                    </div>
                  ) : (
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
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      <AddJobDialog open={addOpen} onOpenChange={setAddOpen} resumes={resumes} />
      <JobDetailDialog job={selectedJob} resumes={resumes} open={Boolean(selectedJob)} onOpenChange={(open) => !open && setSelectedJob(null)} />
      {user?.id && <WelcomeTutorialDialog userId={user.id} open={tutorialOpen} onOpenChange={setTutorialOpen} />}
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
