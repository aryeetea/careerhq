import * as React from "react";
import { isToday, isYesterday, isThisWeek, isWithinInterval, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { Sparkles } from "lucide-react";
import { TimelineCard } from "@/components/applications/TimelineCard";
import type { TimelineEvent } from "@/lib/applications/events";
import type { Job } from "@/types/database";

type GroupKey = "Today" | "Yesterday" | "This Week" | "Last Week" | "Earlier";
const GROUP_ORDER: GroupKey[] = ["Today", "Yesterday", "This Week", "Last Week", "Earlier"];

function groupKeyFor(date: Date, now: Date): GroupKey {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisWeek(date, { weekStartsOn: 0 })) return "This Week";
  const lastWeekStart = startOfWeek(subWeeks(now, 1));
  const lastWeekEnd = endOfWeek(subWeeks(now, 1));
  if (isWithinInterval(date, { start: lastWeekStart, end: lastWeekEnd })) return "Last Week";
  return "Earlier";
}

/** "How has my search progressed?" — a reflective, reverse-chronological
 * read of the same events the Board and Calendar show, grouped the way a
 * journal would be rather than dumped as a flat log. */
export function TimelineView({ events, onOpenJob }: { events: TimelineEvent[]; onOpenJob: (job: Job) => void }) {
  const now = React.useMemo(() => new Date(), []);
  const groups = React.useMemo(() => {
    const map = new Map<GroupKey, TimelineEvent[]>();
    for (const key of GROUP_ORDER) map.set(key, []);
    for (const event of events) {
      map.get(groupKeyFor(event.date, now))!.push(event);
    }
    return map;
  }, [events, now]);

  if (events.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium">Your story starts here</p>
        <p className="max-w-xs text-sm text-muted-foreground">Your journey will appear here as you apply.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6 px-4 pb-10 pt-2 sm:px-8 animate-fade-in">
      {GROUP_ORDER.filter((key) => (groups.get(key)?.length ?? 0) > 0).map((key) => {
        const groupEvents = groups.get(key)!;
        return (
          <section key={key}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{key}</h3>
            <div>
              {groupEvents.map((event, i) => (
                <div key={event.id} className="relative pb-3 last:pb-0">
                  {i < groupEvents.length - 1 && (
                    <span className="absolute bottom-[-0.75rem] left-4 top-9 w-px bg-border/60" aria-hidden="true" />
                  )}
                  <TimelineCard event={event} onOpen={onOpenJob} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
