import { supabase } from "@/lib/supabase";
import type { Job, JobStatus, JobStatusHistoryEntry, NewJob } from "@/types/database";

// Every function here is the ONLY place in the app allowed to talk to
// `jobs` directly. Components go through the useJobs* query hooks, which
// call these. Row Level Security still enforces ownership server-side —
// this layer exists for a single, typed, testable surface.

export async function listJobs(userId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Job[];
}

export async function getJob(id: string): Promise<Job> {
  const { data, error } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Job;
}

export async function createJob(userId: string, input: NewJob): Promise<Job> {
  const { data, error } = await supabase
    .from("jobs")
    .insert({ ...input, user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Job;
}

export async function updateJob(id: string, patch: Partial<Job>): Promise<Job> {
  const { id: _omit, user_id: _omit2, created_at: _omit3, ...safePatch } = patch as Job;
  const { data, error } = await supabase.from("jobs").update(safePatch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Job;
}

// date_applied / interview_date / offer_date / rejection_date are stamped
// server-side (see trg_jobs_stamp_dates in 0001_core_schema.sql) the first
// time status reaches the relevant stage, and are never overwritten once set.
export async function updateJobStatus(id: string, status: JobStatus): Promise<Job> {
  const { data, error } = await supabase.from("jobs").update({ status }).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Job;
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw error;
}

export async function listJobStatusHistory(jobId: string): Promise<JobStatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from("job_status_history")
    .select("*")
    .eq("job_id", jobId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return data as JobStatusHistoryEntry[];
}
