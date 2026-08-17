import type { Job } from "@/types/database";

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
