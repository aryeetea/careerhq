import * as React from "react";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { CalendarEventChip } from "@/components/applications/CalendarEventChip";
import { FollowUpCheckmark } from "@/components/jobs/FollowUpCheckmark";
import { CALENDAR_EVENT_META, type CalendarEvent } from "@/lib/applications/events";
import type { Job } from "@/types/database";
import { cn } from "@/lib/utils";

type CalendarMode = "month" | "week";
const MAX_VISIBLE_PER_DAY = 3;

/** "What's happening this week" — every follow-up, interview, deadline,
 * and offer date, laid out so busy and quiet weeks are obvious at a
 * glance. Purely a transform of the events it's handed; it never fetches
 * anything itself. */
export function CalendarView({ events, onOpenJob }: { events: CalendarEvent[]; onOpenJob: (job: Job) => void }) {
  const [mode, setMode] = React.useState<CalendarMode>("month");
  const [cursor, setCursor] = React.useState(() => new Date());

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = format(event.date, "yyyy-MM-dd");
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  function eventsOn(day: Date): CalendarEvent[] {
    return eventsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
  }

  function goToday() {
    setCursor(new Date());
  }
  function goPrev() {
    setCursor((c) => (mode === "month" ? addMonths(c, -1) : addWeeks(c, -1)));
  }
  function goNext() {
    setCursor((c) => (mode === "month" ? addMonths(c, 1) : addWeeks(c, 1)));
  }

  const weekStart = startOfWeek(cursor);
  const weekEnd = endOfWeek(cursor);
  const monthDays = React.useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) }),
    [cursor]
  );
  const weekDays = React.useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const label = mode === "month" ? format(cursor, "MMMM yyyy") : `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

  const weekHasEvents = weekDays.some((d) => eventsOn(d).length > 0);
  const monthHasEvents = monthDays.some((d) => isSameMonth(d, cursor) && eventsOn(d).length > 0);

  return (
    <div className="flex flex-1 flex-col px-4 pb-6 pt-4 sm:px-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={goPrev} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={goNext} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-1.5 font-display text-lg font-semibold">{label}</span>
        </div>

        <div className="flex gap-1 rounded-2xl border border-border/70 bg-secondary/70 p-1 shadow-soft">
          {(["month", "week"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm font-semibold capitalize transition-all duration-150",
                mode === m ? "bg-card text-foreground shadow-soft ring-1 ring-primary/10" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {(Object.keys(CALENDAR_EVENT_META) as (keyof typeof CALENDAR_EVENT_META)[]).map((type) => (
          <span key={type} className="flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", CALENDAR_EVENT_META[type].dot)} />
            {CALENDAR_EVENT_META[type].label}
          </span>
        ))}
      </div>

      <div key={mode + label} className="animate-fade-in">
        {mode === "month" ? (
          monthHasEvents ? (
            <MonthGrid cursor={cursor} days={monthDays} eventsOn={eventsOn} onOpenJob={onOpenJob} />
          ) : (
            <>
              <MonthGrid cursor={cursor} days={monthDays} eventsOn={eventsOn} onOpenJob={onOpenJob} />
              <QuietNotice className="mt-4" title="No upcoming deadlines yet" />
            </>
          )
        ) : weekHasEvents ? (
          <WeekGrid days={weekDays} eventsOn={eventsOn} onOpenJob={onOpenJob} />
        ) : (
          <QuietNotice title="This week looks quiet" subtitle="Add a follow-up date to a job and it'll show up here." />
        )}
      </div>
    </div>
  );
}

function QuietNotice({ className, title, subtitle }: { className?: string; title: string; subtitle?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/70 py-10 text-center", className)}>
      <CalendarClock className="h-5 w-5 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {subtitle && <p className="max-w-xs text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function DayAgenda({ day, dayEvents, onOpenJob }: { day: Date; dayEvents: CalendarEvent[]; onOpenJob: (job: Job) => void }) {
  return (
    <div className="grid gap-1">
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{format(day, "EEEE, MMMM d")}</p>
      {dayEvents.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nothing scheduled yet.</p>
      ) : (
        dayEvents.map((event) => {
          const meta = CALENDAR_EVENT_META[event.type];
          return (
            <div key={event.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenJob(event.job)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary/60"
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{event.job.company}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {meta.label} · {event.job.title}
                  </span>
                </span>
              </button>
              {event.type === "follow_up" && event.job.follow_up_date && <FollowUpCheckmark job={event.job} className="mr-1" />}
            </div>
          );
        })
      )}
    </div>
  );
}

function MonthGrid({
  cursor,
  days,
  eventsOn,
  onOpenJob,
}: {
  cursor: Date;
  days: Date[];
  eventsOn: (day: Date) => CalendarEvent[];
  onOpenJob: (job: Job) => void;
}) {
  // A day cell holds its own event chips, which are themselves buttons —
  // so the cell can't be a <button> (nested interactive elements are
  // invalid HTML and break keyboard/screen-reader behavior). Instead the
  // cell is a div that opens the day's agenda on click/Enter, anchored via
  // PopoverAnchor with `open` controlled directly, while each chip is a
  // real sibling button that stops its own click from bubbling up.
  const [openDay, setOpenDay] = React.useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60">
      <div className="grid grid-cols-7 border-b border-border/60 bg-secondary/40 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="py-2">
            {format(d, "EEE")}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayKey = day.toISOString();
          const dayEvents = eventsOn(day);
          const inMonth = isSameMonth(day, cursor);
          const overflow = dayEvents.length - MAX_VISIBLE_PER_DAY;
          return (
            <Popover key={dayKey} open={openDay === dayKey} onOpenChange={(open) => setOpenDay(open ? dayKey : null)}>
              <PopoverAnchor asChild>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${format(day, "MMMM d")}'s schedule`}
                  onClick={() => setOpenDay(dayKey)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenDay(dayKey);
                    }
                  }}
                  className={cn(
                    "flex h-24 flex-col gap-1 border-b border-r border-border/50 p-1.5 text-left align-top transition-colors last:border-r-0 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:h-28 sm:p-2",
                    !inMonth && "bg-muted/30"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                      isToday(day) ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/50"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                    {dayEvents.slice(0, MAX_VISIBLE_PER_DAY).map((event) => (
                      <CalendarEventChip key={event.id} event={event} onOpen={(e) => onOpenJob(e.job)} compact />
                    ))}
                    {overflow > 0 && <span className="px-1 text-[10px] font-medium text-muted-foreground">+{overflow} more</span>}
                  </div>
                </div>
              </PopoverAnchor>
              <PopoverContent align="start" className="w-72">
                <DayAgenda day={day} dayEvents={dayEvents} onOpenJob={onOpenJob} />
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  days,
  eventsOn,
  onOpenJob,
}: {
  days: Date[];
  eventsOn: (day: Date) => CalendarEvent[];
  onOpenJob: (job: Job) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7 sm:gap-2">
      {days.map((day) => {
        const dayEvents = eventsOn(day);
        return (
          <div
            key={day.toISOString()}
            className={cn(
              "flex flex-col gap-1.5 rounded-2xl border p-2.5",
              isToday(day) ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card/50"
            )}
          >
            <p className={cn("text-xs font-semibold", isToday(day) ? "text-primary" : "text-muted-foreground")}>
              {format(day, "EEE d")}
            </p>
            {dayEvents.length === 0 ? (
              <p className="py-2 text-[11px] text-muted-foreground/70">Quiet day</p>
            ) : (
              <div className="grid gap-1">
                {dayEvents.map((event) => (
                  <CalendarEventChip key={event.id} event={event} onOpen={(e) => onOpenJob(e.job)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
