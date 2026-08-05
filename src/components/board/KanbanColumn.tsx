import { useDroppable } from "@dnd-kit/core";
import type { Job, JobStatus, Resume } from "@/types/database";
import { STATUS_META } from "@/lib/constants";
import { DraggableJobCard } from "@/components/board/DraggableJobCard";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  status,
  jobs,
  resumeById,
  onOpenJob,
}: {
  status: JobStatus;
  jobs: Job[];
  resumeById: Map<string, Resume>;
  onOpenJob: (job: Job) => void;
}) {
  const meta = STATUS_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}`, data: { status } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl p-1.5 transition-colors",
        isOver && "bg-primary/5 ring-1 ring-primary/25"
      )}
    >
      <div className="flex items-center gap-2 px-1.5 py-2">
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{meta.label}</h3>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{jobs.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pb-2">
        {jobs.map((job) => (
          <DraggableJobCard key={job.id} job={job} resume={job.resume_id ? resumeById.get(job.resume_id) : undefined} onClick={() => onOpenJob(job)} />
        ))}
        {jobs.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground/70">
            Nothing here
          </div>
        )}
      </div>
    </div>
  );
}
