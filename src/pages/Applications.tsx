import * as React from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus, KanbanSquare } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer, PageContent } from "@/components/layout/PageContent";
import { Button } from "@/components/ui/button";
import { FiltersBar } from "@/components/jobs/FiltersBar";
import { KanbanColumn } from "@/components/board/KanbanColumn";
import { MobileJobList } from "@/components/board/MobileJobList";
import { ColumnVisibilityMenu } from "@/components/board/ColumnVisibilityMenu";
import { ViewSwitcher, type ApplicationsView } from "@/components/applications/ViewSwitcher";
import { CalendarView } from "@/components/applications/CalendarView";
import { TimelineView } from "@/components/applications/TimelineView";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { AddJobDialog } from "@/components/jobs/AddJobDialog";
import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";
import { useJobs, useMoveJob, useAllJobStatusHistory } from "@/hooks/queries/useJobs";
import { useResumes } from "@/hooks/queries/useResumes";
import { useSettings, useUpdateSettings } from "@/hooks/queries/useProfile";
import { ALL_BOARD_COLUMNS, ENCOURAGING_EMPTY_MESSAGES } from "@/lib/constants";
import { DEFAULT_FILTERS, matchesFilters, type JobFilters } from "@/types/filters";
import { deriveCalendarEvents, deriveTimelineEvents } from "@/lib/applications/events";
import type { Job, JobStatus } from "@/types/database";
import { useToast } from "@/components/shared/toast";
import { useCelebration } from "@/components/ambient/Celebration";
import { formatDate } from "@/lib/utils";

// The Kanban itself (drag, columns, status logic below) is unchanged from
// the old Board page — only how you get to it changed. "Board" described
// one particular view; "Applications" describes what's actually being
// tracked, with Board, List, and eventually Calendar/Timeline as ways of
// looking at the same roles.
function defaultView(): ApplicationsView {
  return window.matchMedia?.("(max-width: 1023px)").matches ? "list" : "board";
}

export default function Applications() {
  const { data: jobs = [], isLoading, isError, refetch } = useJobs();
  const { data: resumes = [] } = useResumes();
  const { data: settings } = useSettings();
  const { data: statusHistory = [] } = useAllJobStatusHistory();
  const updateSettings = useUpdateSettings();
  const moveJob = useMoveJob();
  const { push } = useToast();
  const { celebrate } = useCelebration();

  const [view, setView] = React.useState<ApplicationsView>(defaultView);
  const [filters, setFilters] = React.useState<JobFilters>(DEFAULT_FILTERS);
  const [addOpen, setAddOpen] = React.useState(false);
  // Holds only the id, not the job object — the object is derived fresh
  // from `jobs` below on every render. Keeping the whole object in state
  // used to need a separate effect to re-sync it whenever `jobs` changed
  // (a cover letter generated, a follow-up completed, a board move, a
  // realtime update from another tab), and that effect's own setState
  // could race the one Save/Cancel uses to close the dialog — closing it
  // would occasionally get silently reopened a beat later. Deriving from
  // the id removes the second copy of truth, and the race along with it.
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
  const selectedJob = React.useMemo(() => jobs.find((j) => j.id === selectedJobId) ?? null, [jobs, selectedJobId]);
  const openJob = React.useCallback((job: Job) => setSelectedJobId(job.id), []);

  const hidden = React.useMemo(() => new Set(settings?.hidden_statuses ?? []), [settings]);
  const visibleColumns = React.useMemo(() => ALL_BOARD_COLUMNS.filter((s) => !hidden.has(s)), [hidden]);
  const visibleSet = React.useMemo(() => new Set(visibleColumns), [visibleColumns]);

  const resumeById = React.useMemo(() => new Map(resumes.map((r) => [r.id, r])), [resumes]);
  // Board, List, Calendar, and Timeline are four views of this one array —
  // filtering happens exactly once, here, and every view downstream (byStatus
  // for Board/List, the two derive*Events calls for Calendar/Timeline) reads
  // from it. A job status history entry whose job got filtered out is
  // automatically dropped too, since deriveTimelineEvents only keeps entries
  // it can match back to a job in the array it's given.
  const filtered = React.useMemo(() => jobs.filter((j) => matchesFilters(j, filters)), [jobs, filters]);
  const byStatus = React.useMemo(() => {
    const map = new Map<JobStatus, Job[]>();
    for (const col of ALL_BOARD_COLUMNS) map.set(col, []);
    for (const job of filtered) map.get(job.status)?.push(job);
    return map;
  }, [filtered]);
  const calendarEvents = React.useMemo(() => deriveCalendarEvents(filtered), [filtered]);
  const timelineEvents = React.useMemo(() => deriveTimelineEvents(filtered, statusHistory), [filtered, statusHistory]);

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
        title="Applications"
        subtitle="Every role you're tracking, organized by stage"
        action={
          <>
            {/* Icon-only on mobile (see ColumnVisibilityMenu), matching the
                Add job button's own responsive treatment right next to it —
                previously hidden below sm entirely, which left no way to
                un-hide a status column (e.g. after a status change lands a
                job in one) on mobile at all. */}
            <ColumnVisibilityMenu visibleColumns={visibleSet} onToggle={handleToggleColumn} />
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add job</span>
            </Button>
          </>
        }
      />

      {hasAnyJobs && (
        <>
          <div className="px-4 pt-7 sm:px-8 sm:pt-8 lg:px-10 lg:pt-9">
            <PageContainer>
              <ViewSwitcher value={view} onChange={setView} />
            </PageContainer>
          </div>
          <FiltersBar filters={filters} onChange={setFilters} resumes={resumes} />
        </>
      )}

      {isError ? (
        <div className="px-4 pt-7 sm:px-8 sm:pt-8 lg:px-10 lg:pt-9">
          <PageContainer>
            <ErrorState description="Your applications couldn't load. Your data is safe — try again." onRetry={() => refetch()} />
          </PageContainer>
        </div>
      ) : isLoading ? (
        <div className="px-4 pt-7 sm:px-8 sm:pt-8 lg:px-10 lg:pt-9">
          <PageContainer className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-96 w-72 rounded-2xl" />
            ))}
          </PageContainer>
        </div>
      ) : !hasAnyJobs ? (
        <PageContent>
          <PageContainer>
            <EmptyState
              icon={<KanbanSquare className="h-5 w-5" />}
              title="Nothing tracked yet"
              description={ENCOURAGING_EMPTY_MESSAGES.noJobsBoard}
              action={
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" /> Add your first job
                </Button>
              }
            />
          </PageContainer>
        </PageContent>
      ) : view === "board" ? (
        <div className="flex-1 overflow-x-auto px-4 pb-8 pt-6 sm:px-8 lg:px-10">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex h-full gap-3" style={{ minWidth: visibleColumns.length * 296 }}>
              {visibleColumns.map((status) => (
                <KanbanColumn key={status} status={status} jobs={byStatus.get(status) ?? []} resumeById={resumeById} onOpenJob={openJob} />
              ))}
            </div>
          </DndContext>
        </div>
      ) : view === "list" ? (
        <div className="flex-1 overflow-y-auto pt-6">
          <MobileJobList columns={visibleColumns} byStatus={byStatus} resumeById={resumeById} onOpenJob={openJob} />
        </div>
      ) : view === "calendar" ? (
        <CalendarView events={calendarEvents} onOpenJob={openJob} />
      ) : (
        <div className="flex-1 overflow-y-auto pt-6">
          <TimelineView events={timelineEvents} onOpenJob={openJob} />
        </div>
      )}

      <AddJobDialog open={addOpen} onOpenChange={setAddOpen} resumes={resumes} />
      <JobDetailDialog job={selectedJob} resumes={resumes} open={Boolean(selectedJob)} onOpenChange={(open) => !open && setSelectedJobId(null)} />
    </div>
  );
}
