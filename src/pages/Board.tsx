import * as React from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus, KanbanSquare } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { FiltersBar } from "@/components/jobs/FiltersBar";
import { KanbanColumn } from "@/components/board/KanbanColumn";
import { MobileJobList } from "@/components/board/MobileJobList";
import { ColumnVisibilityMenu } from "@/components/board/ColumnVisibilityMenu";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { AddJobDialog } from "@/components/jobs/AddJobDialog";
import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";
import { useJobs, useMoveJob } from "@/hooks/queries/useJobs";
import { useResumes } from "@/hooks/queries/useResumes";
import { useSettings, useUpdateSettings } from "@/hooks/queries/useProfile";
import { ALL_BOARD_COLUMNS, ENCOURAGING_EMPTY_MESSAGES } from "@/lib/constants";
import { DEFAULT_FILTERS, matchesFilters, type JobFilters } from "@/types/filters";
import type { Job, JobStatus } from "@/types/database";
import { useToast } from "@/components/shared/toast";
import { useCelebration } from "@/components/ambient/Celebration";
import { formatDate } from "@/lib/utils";

export default function Board() {
  const { data: jobs = [], isLoading, isError, refetch } = useJobs();
  const { data: resumes = [] } = useResumes();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const moveJob = useMoveJob();
  const { push } = useToast();
  const { celebrate } = useCelebration();

  const [filters, setFilters] = React.useState<JobFilters>(DEFAULT_FILTERS);
  const [addOpen, setAddOpen] = React.useState(false);
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);

  const hidden = React.useMemo(() => new Set(settings?.hidden_statuses ?? []), [settings]);
  const visibleColumns = React.useMemo(() => ALL_BOARD_COLUMNS.filter((s) => !hidden.has(s)), [hidden]);
  const visibleSet = React.useMemo(() => new Set(visibleColumns), [visibleColumns]);

  const resumeById = React.useMemo(() => new Map(resumes.map((r) => [r.id, r])), [resumes]);
  const filtered = React.useMemo(() => jobs.filter((j) => matchesFilters(j, filters)), [jobs, filters]);
  const byStatus = React.useMemo(() => {
    const map = new Map<JobStatus, Job[]>();
    for (const col of ALL_BOARD_COLUMNS) map.set(col, []);
    for (const job of filtered) map.get(job.status)?.push(job);
    return map;
  }, [filtered]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleToggleColumn(status: JobStatus, visible: boolean) {
    const next = new Set(hidden);
    if (visible) next.delete(status);
    else next.add(status);
    updateSettings.mutate({ hidden_statuses: Array.from(next) });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const jobId = event.active.id as string;
    const overId = event.over?.id as string | undefined;
    if (!overId?.startsWith("column-")) return;
    const nextStatus = overId.replace("column-", "") as JobStatus;
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status === nextStatus) return;

    try {
      const updated = await moveJob.mutateAsync({ id: jobId, status: nextStatus });
      if (nextStatus === "offer") celebrate("An offer! Take a moment — this is worth celebrating. 🎉");
      else if (nextStatus === "applied" && !job.date_applied && updated.follow_up_date) {
        push(`Application recorded. We'll remind you to follow up on ${formatDate(updated.follow_up_date)}.`, "success");
      } else if (nextStatus === "applied" && !job.date_applied) {
        push(`Marked applied — nice work, ${job.company} is in motion.`, "success");
      }
    } catch {
      push("Couldn't move that job. Try again.", "error");
    }
  }

  const hasAnyJobs = jobs.length > 0;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Board"
        subtitle="Every role you're tracking, organized by stage"
        action={
          <>
            <div className="hidden sm:block">
              <ColumnVisibilityMenu visibleColumns={visibleSet} onToggle={handleToggleColumn} />
            </div>
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add job</span>
            </Button>
          </>
        }
      />

      {hasAnyJobs && <FiltersBar filters={filters} onChange={setFilters} resumes={resumes} />}

      {isError ? (
        <ErrorState className="mx-4 sm:mx-8" description="Your board couldn't load. Your data is safe — try again." onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex gap-4 px-4 sm:px-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-72 rounded-2xl" />
          ))}
        </div>
      ) : !hasAnyJobs ? (
        <EmptyState
          className="mx-4 sm:mx-8"
          icon={<KanbanSquare className="h-5 w-5" />}
          title="Your board is a blank page today"
          description={ENCOURAGING_EMPTY_MESSAGES.noJobsBoard}
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add your first job
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden flex-1 overflow-x-auto px-4 pb-6 sm:px-8 lg:block">
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="flex h-full gap-3" style={{ minWidth: visibleColumns.length * 296 }}>
                {visibleColumns.map((status) => (
                  <KanbanColumn key={status} status={status} jobs={byStatus.get(status) ?? []} resumeById={resumeById} onOpenJob={setSelectedJob} />
                ))}
              </div>
            </DndContext>
          </div>

          <div className="flex-1 overflow-y-auto lg:hidden">
            <MobileJobList columns={visibleColumns} byStatus={byStatus} resumeById={resumeById} onOpenJob={setSelectedJob} />
          </div>
        </>
      )}

      <AddJobDialog open={addOpen} onOpenChange={setAddOpen} resumes={resumes} />
      <JobDetailDialog job={selectedJob} resumes={resumes} open={Boolean(selectedJob)} onOpenChange={(open) => !open && setSelectedJob(null)} />
    </div>
  );
}
