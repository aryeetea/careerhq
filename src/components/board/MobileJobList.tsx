import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { JobCard } from "@/components/jobs/JobCard";
import { STATUS_META } from "@/lib/constants";
import type { Job, JobStatus, Resume } from "@/types/database";
import { cn } from "@/lib/utils";

export function MobileJobList({
  columns,
  byStatus,
  resumeById,
  onOpenJob,
}: {
  columns: JobStatus[];
  byStatus: Map<JobStatus, Job[]>;
  resumeById: Map<string, Resume>;
  onOpenJob: (job: Job) => void;
}) {
  const nonEmpty = columns.filter((c) => (byStatus.get(c) ?? []).length > 0);
  const defaultOpen = nonEmpty.slice(0, 2);

  return (
    <Accordion type="multiple" defaultValue={defaultOpen} className="px-4 pb-6">
      {columns.map((status) => {
        const jobs = byStatus.get(status) ?? [];
        const meta = STATUS_META[status];
        return (
          <AccordionItem key={status} value={status}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                {meta.label}
                <span className="text-xs font-normal tabular-nums text-muted-foreground">{jobs.length}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {jobs.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">Nothing here yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} resume={job.resume_id ? resumeById.get(job.resume_id) : undefined} onClick={() => onOpenJob(job)} />
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
