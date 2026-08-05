import { STATUS_META, VERDICT_META } from "@/lib/constants";
import type { JobStatus, JobVerdict } from "@/types/database";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", meta.badge, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function VerdictBadge({ verdict, className }: { verdict: JobVerdict; className?: string }) {
  const meta = VERDICT_META[verdict];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", meta.className, className)}>
      {meta.emoji} {meta.label}
    </span>
  );
}
