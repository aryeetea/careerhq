import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CALENDAR_EVENT_META, type CalendarEvent } from "@/lib/applications/events";
import { cn } from "@/lib/utils";

/** A small colored pill for one event on one day. Hovering previews the
 * role; clicking opens that job's detail panel directly — Calendar never
 * has its own event modal. */
export function CalendarEventChip({
  event,
  onOpen,
  compact = false,
}: {
  event: CalendarEvent;
  onOpen: (event: CalendarEvent) => void;
  compact?: boolean;
}) {
  const meta = CALENDAR_EVENT_META[event.type];

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(event);
          }}
          className={cn(
            "flex w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-[10.5px] font-medium leading-tight transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            meta.chip,
            compact && "px-1"
          )}
        >
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
          <span className="truncate">{event.job.company}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56">
        <p className="font-semibold">
          {meta.label} · {event.job.title}
        </p>
        <p className="text-background/80">{event.job.company}</p>
      </TooltipContent>
    </Tooltip>
  );
}
