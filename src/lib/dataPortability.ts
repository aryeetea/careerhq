import type { Certification, Job } from "@/types/database";
import type { GoalWithMembers } from "@/services/goals";
import { backupSchema, type BackupData } from "@/lib/validation";

function downloadBlob(content: string, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportJson(jobs: Job[], certifications: Certification[], goals: GoalWithMembers[]) {
  const payload: BackupData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    jobs: jobs.map((j) => ({
      company: j.company,
      title: j.title,
      location: j.location,
      salary: j.salary,
      work_arrangement: j.work_arrangement,
      employment_type: j.employment_type,
      source: j.source,
      job_url: j.job_url,
      job_description: j.job_description,
      status: j.status,
      verdict: j.verdict,
      fit_score: j.fit_score,
      priority: j.priority,
      notes: j.notes,
      date_found: j.date_found,
      date_applied: j.date_applied,
      follow_up_date: j.follow_up_date,
      recruiter_name: j.recruiter_name,
      recruiter_email: j.recruiter_email,
      recruiter_linkedin: j.recruiter_linkedin,
      strengths: j.strengths,
      missing_qualifications: j.missing_qualifications,
      cover_letter_used: j.cover_letter_used,
      deadline: j.deadline,
      interview_date: j.interview_date,
      offer_date: j.offer_date,
      rejection_date: j.rejection_date,
    })),
    certifications: certifications.map((c) => ({
      name: c.name,
      provider: c.provider,
      status: c.status,
      progress_percentage: c.progress_percentage,
      start_date: c.start_date,
      target_completion_date: c.target_completion_date,
      completion_date: c.completion_date,
      expiration_date: c.expiration_date,
      course_link: c.course_link,
      notes: c.notes,
    })),
    goals: goals.map((g) => ({
      name: g.name,
      description: g.description,
      target_count: g.target_count,
      unit: g.unit,
      deadline: g.deadline,
      is_shared: g.is_shared,
    })),
  };
  downloadBlob(JSON.stringify(payload, null, 2), `bloom-backup-${Date.now()}.json`, "application/json");
}

export async function parseBackupFile(file: File): Promise<BackupData> {
  const text = await file.text();
  const raw = JSON.parse(text);
  return backupSchema.parse(raw);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

const CSV_COLUMNS: (keyof Job)[] = [
  "company",
  "title",
  "location",
  "work_arrangement",
  "employment_type",
  "salary",
  "status",
  "verdict",
  "fit_score",
  "priority",
  "date_found",
  "date_applied",
  "follow_up_date",
  "deadline",
  "source",
  "job_url",
  "recruiter_name",
  "recruiter_email",
];

export function exportCsv(jobs: Job[]) {
  const header = CSV_COLUMNS.join(",");
  const rows = jobs.map((job) => CSV_COLUMNS.map((col) => csvEscape(job[col])).join(","));
  downloadBlob([header, ...rows].join("\n"), `bloom-jobs-${Date.now()}.csv`, "text/csv");
}
