import type { Job, Resume } from "@/types/database";

export interface GardenStage {
  key: string;
  emoji: string;
  label: string;
  description: string;
  unlocked: boolean;
  /** ISO date the stage was reached, when derivable — best-effort only. */
  unlockedAt: string | null;
}

function earliest(dates: (string | null | undefined)[]): string | null {
  const valid = dates.filter((d): d is string => Boolean(d));
  if (valid.length === 0) return null;
  return valid.reduce((min, d) => (new Date(d) < new Date(min) ? d : min));
}

// Bloom Garden — six stages, all derived from data already loaded on the
// Profile page (no new persistence). Dates are exact where the underlying
// timestamp exists (e.g. the 10th application's real date_applied), not
// approximated from an activity log.
export function computeGardenStages(jobs: Job[], resumes: Resume[], accountCreatedAt: string): GardenStage[] {
  const appliedJobs = jobs
    .filter((j) => j.date_applied)
    .sort((a, b) => new Date(a.date_applied!).getTime() - new Date(b.date_applied!).getTime());
  const interviewJobs = jobs.filter((j) => j.status === "interview" || j.status === "final_interview");
  const offerJobs = jobs.filter((j) => j.status === "offer");
  const dreamJobs = offerJobs.filter((j) => j.priority === 3);

  const tenthApplication = appliedJobs.length >= 10 ? appliedJobs[9] : null;

  return [
    {
      key: "account_created",
      emoji: "🌱",
      label: "Account created",
      description: "Every search starts with one small step.",
      unlocked: true,
      unlockedAt: accountCreatedAt,
    },
    {
      key: "resume_uploaded",
      emoji: "🌿",
      label: "Resume uploaded",
      description: "Your first resume is saved and ready to send.",
      unlocked: resumes.length > 0,
      unlockedAt: earliest(resumes.map((r) => r.created_at)),
    },
    {
      key: "first_interview",
      emoji: "🌸",
      label: "First interview",
      description: "Someone wants to meet you — that's real momentum.",
      unlocked: interviewJobs.length > 0,
      unlockedAt: earliest(interviewJobs.map((j) => j.interview_date)),
    },
    {
      key: "ten_applications",
      emoji: "🌺",
      label: "10 applications",
      description: "Ten applications in — consistency is showing.",
      unlocked: tenthApplication !== null,
      unlockedAt: tenthApplication?.date_applied ?? null,
    },
    {
      key: "first_offer",
      emoji: "🪷",
      label: "First offer",
      description: "An offer on the table. Well earned.",
      unlocked: offerJobs.length > 0,
      unlockedAt: earliest(offerJobs.map((j) => j.offer_date)),
    },
    {
      key: "dream_job",
      emoji: "🌳",
      label: "Dream job",
      description: "A high-priority offer — the one you were aiming for.",
      unlocked: dreamJobs.length > 0,
      unlockedAt: earliest(dreamJobs.map((j) => j.offer_date)),
    },
  ];
}
