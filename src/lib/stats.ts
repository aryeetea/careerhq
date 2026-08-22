import type { Job } from "@/types/database";
import { jobNeedsRequirementConfirmation } from "@/lib/jobRequirements";

function toDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface DashboardStats {
  jobsSaved: number;
  applicationsSubmitted: number;
  interviews: number;
  offers: number;
  rejections: number;
  /** Applications still sitting at "Applied" 14+ days after date_applied,
   * with no interview/offer/rejection recorded. A factual, computed signal
   * rather than a judgmental "Ghosted" label — nothing is ever auto-marked
   * ghosted. */
  noResponse: number;
  /** Trailing 7 calendar days (today inclusive), not a Monday-Sunday
   * calendar week. A calendar-week version of this was tried — it made the
   * goal card "properly reset" on Monday, but in practice that meant
   * applications from two days ago could vanish from "this week" the
   * instant a new week began, which read as broken rather than correct.
   * A rolling window never has that jump: yesterday's applications still
   * count today, they just age out one day at a time. last7Days below uses
   * the same window so the two "this week" widgets always agree. */
  applicationsThisWeek: number;
  applicationsThisMonth: number;
  responseRate: number;
  currentStreak: number;
  last7Days: { date: string; count: number }[];
}

export function computeDashboardStats(jobs: Job[]): DashboardStats {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setMonth(now.getMonth() - 1);

  const applied = jobs.filter((j) => j.date_applied);
  // Jobs currently sitting at "Saved" — not a lifetime count of everything
  // ever added. A job that's moved on to Applied (or any later stage)
  // belongs in that bucket, not this one; counting it in both would make
  // "Jobs saved" look inflated and disconnected from the Board's Saved
  // column right next to it.
  const jobsSaved = jobs.filter((j) => j.status === "saved").length;
  const applicationsSubmitted = applied.length;
  const interviews = jobs.filter((j) => j.status === "interview" || j.status === "final_interview").length;
  const offers = jobs.filter((j) => j.status === "offer").length;
  const rejections = jobs.filter((j) => j.status === "rejected").length;
  const noResponse = jobs.filter(
    (j) => j.status === "applied" && j.date_applied && now.getTime() - new Date(j.date_applied).getTime() >= 14 * 86400000
  ).length;

  const applicationsThisWeek = applied.filter((j) => new Date(j.date_applied!) >= weekAgo).length;
  const applicationsThisMonth = applied.filter((j) => new Date(j.date_applied!) >= monthAgo).length;

  const responded = applied.filter((j) => ["interview", "final_interview", "offer", "rejected"].includes(j.status)).length;
  const responseRate = applicationsSubmitted > 0 ? Math.round((responded / applicationsSubmitted) * 100) : 0;

  // Streak: consecutive days up to today with >= 1 application.
  const appliedDays = new Set(applied.map((j) => toDayKey(new Date(j.date_applied!))));
  let currentStreak = 0;
  const cursor = new Date(now);
  while (appliedDays.has(toDayKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const last7Days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = toDayKey(d);
    last7Days.push({ date: key, count: appliedDays.has(key) ? applied.filter((j) => toDayKey(new Date(j.date_applied!)) === key).length : 0 });
  }

  return {
    jobsSaved,
    applicationsSubmitted,
    interviews,
    offers,
    rejections,
    noResponse,
    applicationsThisWeek,
    applicationsThisMonth,
    responseRate,
    currentStreak,
    last7Days,
  };
}

// Shared by Dashboard's "Upcoming interviews" list and Profile's achievements
// card — jobs in an interview stage, most recent first.
export function getUpcomingInterviews(jobs: Job[], limit = 5): Job[] {
  return jobs
    .filter((j) => (j.status === "interview" || j.status === "final_interview") && j.interview_date)
    .sort((a, b) => new Date(b.interview_date!).getTime() - new Date(a.interview_date!).getTime())
    .slice(0, limit);
}

export type DashboardStatKind =
  | "jobs-saved"
  | "applications-sent"
  | "interviews"
  | "offers"
  | "rejections"
  | "follow-ups-due"
  | "response-rate"
  | "no-response"
  | "requirements-to-confirm";

export const DASHBOARD_STAT_META: Record<DashboardStatKind, { title: string; description: string; emptyMessage: string }> = {
  "jobs-saved": {
    title: "Jobs saved",
    description: "Roles you've saved but haven't applied to yet.",
    emptyMessage: "Nothing saved right now — roles you bookmark to apply to later show up here.",
  },
  "applications-sent": {
    title: "Applications sent",
    description: "Every role you've applied to, most recent first.",
    emptyMessage: "Nothing applied to yet.",
  },
  interviews: {
    title: "Interviews",
    description: "Roles currently at an interview or final-interview stage.",
    emptyMessage: "No interviews in progress right now.",
  },
  offers: {
    title: "Offers",
    description: "Roles that have made you an offer.",
    emptyMessage: "No offers yet — they'll show up here the moment one comes in.",
  },
  rejections: {
    title: "Rejections",
    description: "Roles that passed. Each one is evidence you applied, not evidence of anything about you.",
    emptyMessage: "No rejections logged.",
  },
  "follow-ups-due": {
    title: "Follow-ups due",
    description: "Roles with a follow-up date today or earlier.",
    emptyMessage: "Nothing due right now. Enjoy the quiet.",
  },
  "response-rate": {
    title: "Response rate",
    description: "Applications that heard back — an interview, an offer, or a rejection.",
    emptyMessage: "No responses yet.",
  },
  "no-response": {
    title: "No response in 14 days",
    description: "Still sitting at \"Applied\" two weeks or more after you sent it — a factual signal, not a verdict.",
    emptyMessage: "Nothing's gone quiet for 14+ days.",
  },
  "requirements-to-confirm": {
    title: "Requirements to confirm",
    description: "Jobs with a hard requirement the AI couldn't verify — answer it once and it's applied everywhere that requirement comes up.",
    emptyMessage: "Nothing waiting on you — every flagged requirement has an answer.",
  },
};

// Backs the dedicated detail page each Dashboard stat card links to.
// Deliberately mirrors the predicates in computeDashboardStats above
// (rather than that function returning arrays it then .length's) so the
// number on the card and the list behind it can never drift apart — see
// the last7Days/applicationsThisWeek mismatch this app already hit once.
export function getJobsForStatKind(
  jobs: Job[],
  kind: DashboardStatKind,
  // Only "requirements-to-confirm" needs this — every other kind ignores
  // it, so callers that never touch that kind can omit it entirely.
  confirmedRequirementKeys: ReadonlySet<string> = new Set()
): Job[] {
  const now = new Date();
  switch (kind) {
    case "jobs-saved":
      return jobs.filter((j) => j.status === "saved");
    case "applications-sent":
      return jobs
        .filter((j) => j.date_applied)
        .sort((a, b) => new Date(b.date_applied!).getTime() - new Date(a.date_applied!).getTime());
    case "interviews":
      return jobs.filter((j) => j.status === "interview" || j.status === "final_interview");
    case "offers":
      return jobs.filter((j) => j.status === "offer");
    case "rejections":
      return jobs.filter((j) => j.status === "rejected");
    case "follow-ups-due": {
      const today = toDayKey(now);
      return jobs
        .filter((j) => j.follow_up_date && j.follow_up_date.slice(0, 10) <= today)
        .sort((a, b) => a.follow_up_date!.localeCompare(b.follow_up_date!));
    }
    case "response-rate":
      return jobs
        .filter((j) => j.date_applied && ["interview", "final_interview", "offer", "rejected"].includes(j.status))
        .sort((a, b) => new Date(b.date_applied!).getTime() - new Date(a.date_applied!).getTime());
    case "no-response":
      return jobs.filter(
        (j) => j.status === "applied" && j.date_applied && now.getTime() - new Date(j.date_applied).getTime() >= 14 * 86400000
      );
    case "requirements-to-confirm":
      return jobs.filter((j) => jobNeedsRequirementConfirmation(j, confirmedRequirementKeys));
    default:
      return [];
  }
}
