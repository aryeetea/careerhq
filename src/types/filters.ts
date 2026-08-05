import type { JobStatus, JobVerdict, WorkArrangement } from "@/types/database";

export interface JobFilters {
  search: string;
  status: JobStatus | "all";
  verdict: JobVerdict | "all";
  resumeId: string | "all";
  workArrangement: WorkArrangement | "all";
  priority: number | "all";
}

export const DEFAULT_FILTERS: JobFilters = {
  search: "",
  status: "all",
  verdict: "all",
  resumeId: "all",
  workArrangement: "all",
  priority: "all",
};

export function matchesFilters(
  job: { company: string; title: string; location: string | null; recruiter_name: string | null; notes: string | null; status: JobStatus; verdict: JobVerdict | null; resume_id: string | null; work_arrangement: WorkArrangement | null; priority: number },
  filters: JobFilters
): boolean {
  if (filters.status !== "all" && job.status !== filters.status) return false;
  if (filters.verdict !== "all" && job.verdict !== filters.verdict) return false;
  if (filters.resumeId !== "all" && job.resume_id !== filters.resumeId) return false;
  if (filters.workArrangement !== "all" && job.work_arrangement !== filters.workArrangement) return false;
  if (filters.priority !== "all" && job.priority !== filters.priority) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const haystack = `${job.company} ${job.title} ${job.location ?? ""} ${job.recruiter_name ?? ""} ${job.notes ?? ""}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}
