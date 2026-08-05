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
  ghosted: number;
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
  const jobsSaved = jobs.length;
  const applicationsSubmitted = applied.length;
  const interviews = jobs.filter((j) => j.status === "interview" || j.status === "final_interview").length;
  const offers = jobs.filter((j) => j.status === "offer").length;
  const rejections = jobs.filter((j) => j.status === "rejected").length;
  const ghosted = jobs.filter((j) => j.status === "ghosted").length;

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
    ghosted,
    applicationsThisWeek,
    applicationsThisMonth,
    responseRate,
    currentStreak,
    last7Days,
  };
}
