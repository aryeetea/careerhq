import { parseISO } from "date-fns";
import { Bookmark, Send, ClipboardCheck, PhoneCall, Users, Trophy, XCircle, Ghost, Archive, CalendarClock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Job, JobStatus, JobStatusHistoryEntry } from "@/types/database";

// Calendar and Timeline are not separate datasets — both are pure
// transforms of the same `jobs` (and, for Timeline, `job_status_history`)
// arrays already loaded by useJobs()/useAllJobStatusHistory(). Nothing
// here fetches anything; a move on the Board or an edit in Job Details
// updates the source arrays, and both views re-derive from that on the
// next render, automatically.

export type CalendarEventType = "applied" | "interview" | "follow_up" | "deadline" | "offer" | "rejected";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  date: Date;
  job: Job;
}

export const CALENDAR_EVENT_META: Record<CalendarEventType, { label: string; dot: string; chip: string; ring: string }> = {
  applied: { label: "Applied", dot: "bg-primary", chip: "bg-primary/12 text-primary", ring: "ring-primary/25" },
  interview: { label: "Interview", dot: "bg-lavender", chip: "bg-lavender/20 text-lavender-foreground", ring: "ring-lavender/30" },
  follow_up: { label: "Follow-up", dot: "bg-gold", chip: "bg-gold/15 text-gold", ring: "ring-gold/30" },
  deadline: { label: "Deadline", dot: "bg-peach", chip: "bg-peach/20 text-peach-foreground", ring: "ring-peach/30" },
  offer: { label: "Offer", dot: "bg-success", chip: "bg-success/15 text-success", ring: "ring-success/30" },
  rejected: { label: "Rejected", dot: "bg-destructive", chip: "bg-destructive/15 text-destructive", ring: "ring-destructive/25" },
};

/** Every date a job carries, turned into a calendar event. A job with a
 * follow-up, an interview, and a deadline shows up on all three days —
 * that's the point: the calendar is a schedule, not a job list. */
export function deriveCalendarEvents(jobs: Job[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const job of jobs) {
    if (job.follow_up_date) events.push({ id: `${job.id}-follow_up`, type: "follow_up", date: parseISO(job.follow_up_date), job });
    if (job.deadline) events.push({ id: `${job.id}-deadline`, type: "deadline", date: parseISO(job.deadline), job });
    if (job.interview_date) events.push({ id: `${job.id}-interview`, type: "interview", date: parseISO(job.interview_date), job });
    if (job.date_applied) events.push({ id: `${job.id}-applied`, type: "applied", date: parseISO(job.date_applied), job });
    if (job.offer_date) events.push({ id: `${job.id}-offer`, type: "offer", date: parseISO(job.offer_date), job });
    if (job.rejection_date) events.push({ id: `${job.id}-rejected`, type: "rejected", date: parseISO(job.rejection_date), job });
  }
  return events;
}

export type TimelineEventType = JobStatus | "follow_up";

// Warmer than the raw status names — a timeline is a story someone is
// reading back about their own search, not a system log. Colors reuse
// STATUS_META's palette (constants.tsx) so a status means the same thing
// on the Board and in the Timeline.
export const TIMELINE_EVENT_META: Record<TimelineEventType, { label: string; icon: LucideIcon; className: string }> = {
  saved: { label: "Saved", icon: Bookmark, className: "bg-slate-400/15 text-slate-500" },
  applying: { label: "Started applying", icon: Send, className: "bg-sky/15 text-sky" },
  applied: { label: "Applied", icon: Send, className: "bg-primary/15 text-primary" },
  assessment: { label: "Assessment", icon: ClipboardCheck, className: "bg-gold/15 text-gold" },
  recruiter_contacted: { label: "Recruiter reached out", icon: PhoneCall, className: "bg-peach/20 text-peach-foreground" },
  interview: { label: "Interview scheduled", icon: Users, className: "bg-lavender/20 text-lavender-foreground" },
  final_interview: { label: "Final interview", icon: Users, className: "bg-lavender/30 text-lavender-foreground" },
  offer: { label: "Offer received", icon: Trophy, className: "bg-success/15 text-success" },
  rejected: { label: "Not moving forward", icon: XCircle, className: "bg-destructive/15 text-destructive" },
  ghosted: { label: "Went quiet", icon: Ghost, className: "bg-zinc-400/15 text-zinc-500" },
  closed: { label: "Closed", icon: Archive, className: "bg-neutral-400/15 text-neutral-500" },
  archived: { label: "Archived", icon: Archive, className: "bg-neutral-300/15 text-neutral-400" },
  follow_up: { label: "Follow-up", icon: CalendarClock, className: "bg-gold/15 text-gold" },
};

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: Date;
  job: Job;
  fromStatus: JobStatus | null;
}

/** job_status_history already IS the story — Bloom logs a row (with the
 * status a job started at, null on first save) on every single transition,
 * so nothing here needs to be inferred or guessed. Follow-ups are the one
 * milestone that isn't a status change, so they're merged in from the
 * job's own follow_up_date. */
export function deriveTimelineEvents(jobs: Job[], history: JobStatusHistoryEntry[]): TimelineEvent[] {
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const events: TimelineEvent[] = [];

  for (const entry of history) {
    const job = jobById.get(entry.job_id);
    if (!job) continue;
    events.push({ id: entry.id, type: entry.to_status, date: parseISO(entry.changed_at), job, fromStatus: entry.from_status });
  }

  for (const job of jobs) {
    if (job.follow_up_date) {
      events.push({ id: `${job.id}-follow_up`, type: "follow_up", date: parseISO(job.follow_up_date), job, fromStatus: null });
    }
  }

  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}
