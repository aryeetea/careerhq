import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Job, JobStatus, Resume } from "@/types/database";
import { JobCard } from "@/components/jobs/JobCard";

export function DraggableJobCard({
  job,
  resume,
  onClick,
  statusOptions,
  onStatusChange,
}: {
  job: Job;
  resume?: Resume;
  onClick: () => void;
  statusOptions?: { value: JobStatus; label: string }[];
  onStatusChange?: (job: Job, status: JobStatus) => void | Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { status: job.status },
  });

  return (
    <JobCard
      ref={setNodeRef}
      job={job}
      resume={resume}
      onClick={onClick}
      isDragging={isDragging}
      dragAttributes={attributes}
      dragListeners={listeners}
      style={{ transform: CSS.Translate.toString(transform) }}
      statusOptions={statusOptions}
      onStatusChange={onStatusChange}
    />
  );
}
