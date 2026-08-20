import { supabase } from "@/lib/supabase";
import type { Job, JobAiResumeTailoring, JobStatus, JobStatusHistoryEntry, NewJob } from "@/types/database";

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

// date_applied / follow_up_date / interview_date / offer_date /
// rejection_date are stamped server-side (see trg_jobs_stamp_dates in the
// Supabase migrations) the first time status reaches the relevant stage, and
// are never overwritten once set.
export async function updateJobStatus(id: string, status: JobStatus): Promise<Job> {
  const { data, error } = await supabase.from("jobs").update({ status }).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Job;
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw error;
}

// Marks the currently-open follow-up done: stamps followed_up_at, clears
// follow_up_date (so it drops out of overdue/upcoming lists immediately),
// and advances follow_up_round. nextRound is computed by the caller from
// the job it already has in hand rather than a round-trip read-then-write.
export async function completeFollowUp(id: string, nextRound: number): Promise<Job> {
  const { data, error } = await supabase
    .from("jobs")
    .update({ followed_up_at: new Date().toISOString(), follow_up_date: null, follow_up_round: nextRound })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Job;
}

// Persists a generated cover letter the moment it's ready — a dedicated,
// narrow write, deliberately separate from the job's full-form "Save
// changes" so the letter survives even if the dialog is closed without
// touching anything else. Never called with an empty string on a failed
// generation; the caller only invokes this after a successful response.
export async function saveCoverLetter(id: string, coverLetter: string, resumeId: string | null): Promise<Job> {
  const patch: Partial<Job> = { ai_cover_letter: coverLetter, ai_cover_letter_updated_at: new Date().toISOString() };
  if (resumeId) patch.resume_id = resumeId;
  const { data, error } = await supabase.from("jobs").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Job;
}

// Same narrow-write shape as saveCoverLetter — persists a generated (or
// user-edited) tailored résumé immediately so it survives closing the
// dialog without touching the job's other fields.
export async function saveResumeTailoring(id: string, tailoring: JobAiResumeTailoring, resumeId: string | null): Promise<Job> {
  const patch: Partial<Job> = { ai_resume_tailoring: tailoring, ai_resume_tailoring_updated_at: new Date().toISOString() };
  if (resumeId) patch.resume_id = resumeId;
  const { data, error } = await supabase.from("jobs").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Job;
}

// The optional second follow-up a user can accept after the first is
// done — never offered automatically past round 2 (see follow_up_round).
export async function scheduleAnotherFollowUp(id: string, followUpDate: string): Promise<Job> {
  const { data, error } = await supabase
    .from("jobs")
    .update({ follow_up_date: followUpDate, followed_up_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Job;
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

// The Timeline view's source of truth: one row per status transition
// (including the initial save, from_status null) across every job, in one
// request — not one request per job. status_history_owner_select scopes
// this to the caller's own rows.
export async function listAllJobStatusHistory(userId: string): Promise<JobStatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from("job_status_history")
    .select("*")
    .eq("user_id", userId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return data as JobStatusHistoryEntry[];
}
