import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Job, Resume } from "@/types/database";
import { JobCard } from "@/components/jobs/JobCard";

export function DraggableJobCard({ job, resume, onClick }: { job: Job; resume?: Resume; onClick: () => void }) {
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
    />
  );
}
