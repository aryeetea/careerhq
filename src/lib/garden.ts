import type { Job, Resume } from "@/types/database";

export interface GardenStage {
  key: string;
  growthLabel: string;
  milestoneLabel: string;
  description: string;
  unlocked: boolean;
  isNext: boolean;
  /** ISO date the stage was reached, when derivable — best-effort only. */
  unlockedAt: string | null;
}

function earliest(dates: (string | null | undefined)[]): string | null {
  const valid = dates.filter((d): d is string => Boolean(d));
  if (valid.length === 0) return null;
  return valid.reduce((min, d) => (new Date(d) < new Date(min) ? d : min));
}

export function computeGardenStages(jobs: Job[], resumes: Resume[], accountCreatedAt: string): GardenStage[] {
  const appliedJobs = jobs
    .filter((j) => j.date_applied)
    .sort((a, b) => new Date(a.date_applied!).getTime() - new Date(b.date_applied!).getTime());
  const firstApplication = appliedJobs[0] ?? null;
  const interviewJobs = jobs.filter((j) => j.interview_date || j.status === "interview" || j.status === "final_interview");
  const offerJobs = jobs.filter((j) => j.offer_date || j.status === "offer");
  const dreamJobs = offerJobs.filter((j) => j.priority === 3);

  const tenthApplication = appliedJobs.length >= 10 ? appliedJobs[9] : null;

  const stages: Omit<GardenStage, "isNext">[] = [
    {
      key: "account_created",
      growthLabel: "Seed",
      milestoneLabel: "Account created",
      description: "Your garden has been planted.",
      unlocked: true,
      unlockedAt: accountCreatedAt,
    },
    {
      key: "resume_uploaded",
      growthLabel: "Sprout",
      milestoneLabel: "Resume uploaded",
      description: "Your foundation is taking root.",
      unlocked: resumes.length > 0,
      unlockedAt: earliest(resumes.map((r) => r.created_at)),
    },
    {
      key: "first_application",
      growthLabel: "Young plant",
      milestoneLabel: "First application",
      description: "You've taken the first step into the field.",
      unlocked: firstApplication !== null,
      unlockedAt: firstApplication?.date_applied ?? null,
    },
    {
      key: "ten_applications",
      growthLabel: "Bud",
      milestoneLabel: "10 applications",
      description: "Consistency is turning into momentum.",
      unlocked: tenthApplication !== null,
      unlockedAt: tenthApplication?.date_applied ?? null,
    },
    {
      key: "first_interview",
      growthLabel: "First bloom",
      milestoneLabel: "First interview",
      description: "Your experience is getting noticed.",
      unlocked: interviewJobs.length > 0,
      unlockedAt: earliest(interviewJobs.map((j) => j.interview_date)),
    },
    {
      key: "first_offer",
      growthLabel: "Flourishing bloom",
      milestoneLabel: "First offer",
      description: "Your work has opened a new door.",
      unlocked: offerJobs.length > 0,
      unlockedAt: earliest(offerJobs.map((j) => j.offer_date)),
    },
    {
      key: "dream_job",
      growthLabel: "Garden in full bloom",
      milestoneLabel: "Dream job",
      description: "A role worth celebrating has come into focus.",
      unlocked: dreamJobs.length > 0,
      unlockedAt: earliest(dreamJobs.map((j) => j.offer_date)),
    },
  ];

  const nextIndex = stages.findIndex((stage) => !stage.unlocked);
  return stages.map((stage, index) => ({ ...stage, isNext: nextIndex === index }));
}
