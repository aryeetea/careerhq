import * as React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Inbox } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageContent, PageContainer } from "@/components/layout/PageContent";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { JobCard } from "@/components/jobs/JobCard";
import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";
import { useJobs } from "@/hooks/queries/useJobs";
import { useResumes } from "@/hooks/queries/useResumes";
import { computeDashboardStats, getJobsForStatKind, DASHBOARD_STAT_META, type DashboardStatKind } from "@/lib/stats";

const VALID_KINDS = new Set<string>(Object.keys(DASHBOARD_STAT_META));

/** Where every Dashboard stat card lands. One page, driven by the ":kind"
 * route param, rather than 8 near-identical page files — the list behind
 * each card is just "the jobs matching that stat's own predicate" (see
 * getJobsForStatKind, which mirrors computeDashboardStats exactly so the
 * number on the card and what you land on can never disagree), rendered
 * with the same JobCard used on the board. Always a "Back to Dashboard"
 * button, never just a browser-back expectation. */
export default function DashboardStatDetail() {
  const { kind: kindParam } = useParams<{ kind: string }>();
  const { data: jobs = [], isLoading, isError, refetch } = useJobs();
  const { data: resumes = [] } = useResumes();
  const resumeById = React.useMemo(() => new Map(resumes.map((r) => [r.id, r])), [resumes]);

  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
  const selectedJob = React.useMemo(() => jobs.find((j) => j.id === selectedJobId) ?? null, [jobs, selectedJobId]);

  if (!kindParam || !VALID_KINDS.has(kindParam)) {
    return <Navigate to="/app" replace />;
  }
  const kind = kindParam as DashboardStatKind;
  const meta = DASHBOARD_STAT_META[kind];

  const list = React.useMemo(() => getJobsForStatKind(jobs, kind), [jobs, kind]);
  const stats = React.useMemo(() => computeDashboardStats(jobs), [jobs]);

  const backButton = (
    <Button variant="ghost" size="sm" className="gap-1.5" asChild>
      <Link to="/app">
        <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back to Dashboard</span>
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title={meta.title} subtitle={meta.description} action={backButton} />
      <PageContent>
        <PageContainer>
          {isError ? (
            <ErrorState description="This couldn't load. Your data is safe — try again." onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="grid gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState icon={<Inbox className="h-5 w-5" />} title={meta.title} description={meta.emptyMessage} />
          ) : (
            <>
              {kind === "response-rate" && (
                <p className="mb-4 text-sm text-muted-foreground">
                  <span className="font-mono text-base font-semibold text-foreground tabular-nums">{stats.responseRate}%</span> response rate —{" "}
                  {list.length} of {stats.applicationsSubmitted} application{stats.applicationsSubmitted === 1 ? "" : "s"} heard back.
                </p>
              )}
              <div className="grid gap-2.5">
                {list.map((job) => (
                  <JobCard key={job.id} job={job} resume={job.resume_id ? resumeById.get(job.resume_id) : undefined} onClick={() => setSelectedJobId(job.id)} />
                ))}
              </div>
            </>
          )}
        </PageContainer>
      </PageContent>

      <JobDetailDialog
        job={selectedJob}
        resumes={resumes}
        open={Boolean(selectedJob)}
        onOpenChange={(open) => !open && setSelectedJobId(null)}
      />
    </div>
  );
}
