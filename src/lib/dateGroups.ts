import { isToday, isYesterday, isThisWeek, isWithinInterval, startOfWeek, endOfWeek, subWeeks } from "date-fns";

export type DateGroupKey = "Today" | "Yesterday" | "This Week" | "Last Week" | "Earlier";
export const DATE_GROUP_ORDER: DateGroupKey[] = ["Today", "Yesterday", "This Week", "Last Week", "Earlier"];

function keyFor(date: Date, now: Date): DateGroupKey {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisWeek(date, { weekStartsOn: 0 })) return "This Week";
  const lastWeekStart = startOfWeek(subWeeks(now, 1));
  const lastWeekEnd = endOfWeek(subWeeks(now, 1));
  if (isWithinInterval(date, { start: lastWeekStart, end: lastWeekEnd })) return "Last Week";
  return "Earlier";
}

/** Buckets items the way a journal or a timeline reads back naturally —
 * Today, Yesterday, This Week, Last Week, Earlier — instead of a flat,
 * undifferentiated list. Shared by Timeline and Journal so both group the
 * same way. */
export function groupByRecency<T>(items: T[], getDate: (item: T) => Date, now = new Date()): Map<DateGroupKey, T[]> {
  const map = new Map<DateGroupKey, T[]>();
  for (const key of DATE_GROUP_ORDER) map.set(key, []);
  for (const item of items) {
    map.get(keyFor(getDate(item), now))!.push(item);
  }
  return map;
}
