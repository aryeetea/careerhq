import { TIMELINE_EVENT_META, type TimelineEvent } from "@/lib/applications/events";
import { timeAgo } from "@/lib/utils";
import type { Job } from "@/types/database";
import { cn } from "@/lib/utils";

/** One compact, clickable row in the story — an icon, what happened, to
 * which role, and how long ago. Never a giant card. */
export function TimelineCard({ event, onOpen }: { event: TimelineEvent; onOpen: (job: Job) => void }) {
  const meta = TIMELINE_EVENT_META[event.type];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={() => onOpen(event.job)}
      className="group flex w-full min-w-0 items-start gap-3 rounded-xl py-1 pr-2 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-background", meta.className)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 pt-1">
        <span className="block text-sm font-medium leading-tight transition-colors group-hover:text-primary">{meta.label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {event.job.title} · {event.job.company}
        </span>
      </span>
      <span className="shrink-0 pt-1.5 text-[11px] text-muted-foreground/75">{timeAgo(event.date.toISOString())}</span>
    </button>
  );
}
