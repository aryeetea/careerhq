import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import * as jobsService from "@/services/jobs";
import { logActivity } from "@/services/activity";
import type { Job, JobStatus, JobStatusHistoryEntry, NewJob } from "@/types/database";

// Logs a Recent Activity entry the first time a job crosses into one of
// these milestone statuses. Shared by useCreateJob (manual entry can start
// past "saved"), useUpdateJob (edit dialog), and useMoveJob (board drag).
function logStatusTransition(userId: string, previousStatus: JobStatus | undefined, job: Job) {
  if (!previousStatus || previousStatus === job.status) return;
  const wasInterviewing = previousStatus === "interview" || previousStatus === "final_interview";
  if (job.status === "applied") {
    void logActivity(userId, "job_applied", `Applied to ${job.company}`, { jobId: job.id });
  } else if ((job.status === "interview" || job.status === "final_interview") && !wasInterviewing) {
    void logActivity(userId, "interview_scheduled", `Interview scheduled with ${job.company}`, { jobId: job.id });
  } else if (job.status === "offer") {
    void logActivity(userId, "offer_received", `Received an offer from ${job.company}`, { jobId: job.id });
  }
}

export function useJobs() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.jobs(userId),
    queryFn: () => jobsService.listJobs(userId),
    enabled: Boolean(userId),
  });
}

// Mounted once (see RealtimeSync) so a job changed on another tab or
// device — or, later, by any server-side automation — reaches this
// session's Board/List/Calendar/Timeline/Dashboard/Garden without a
// refresh. Patches the same cache entry every mutation in this file
// already writes to, so there's exactly one source of truth for "jobs"
// regardless of which client changed them.
export function useJobsRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";

  useRealtimeTable<Job>({
    channel: `jobs:${userId}`,
    table: "jobs",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: Boolean(userId),
    onChange: (payload) => {
      const key = queryKeys.jobs(userId);
      if (payload.eventType === "INSERT") {
        const job = payload.new as Job;
        qc.setQueryData<Job[]>(key, (prev) => (prev?.some((j) => j.id === job.id) ? prev : [job, ...(prev ?? [])]));
      } else if (payload.eventType === "UPDATE") {
        const job = payload.new as Job;
        qc.setQueryData<Job[]>(key, (prev) => prev?.map((j) => (j.id === job.id ? job : j)));
      } else if (payload.eventType === "DELETE") {
        const oldId = (payload.old as { id?: string }).id;
        if (oldId) qc.setQueryData<Job[]>(key, (prev) => prev?.filter((j) => j.id !== oldId));
      }
      qc.invalidateQueries({ queryKey: queryKeys.allJobStatusHistory(userId) });
    },
  });
}

export function useJobStatusHistory(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.jobStatusHistory(jobId ?? ""),
    queryFn: () => jobsService.listJobStatusHistory(jobId as string),
    enabled: Boolean(jobId),
  });
}

// The Timeline view's data source — every status transition, across every
// job, in one request. Loaded once alongside useJobs() and cached, so
// switching between Board/List/Calendar/Timeline never re-fetches; only a
// real change (see the invalidation calls below) refreshes it.
export function useAllJobStatusHistory() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.allJobStatusHistory(userId),
    queryFn: () => jobsService.listAllJobStatusHistory(userId),
    enabled: Boolean(userId),
  });
}

export function useCreateJob() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewJob) => jobsService.createJob(user!.id, input),
    onSuccess: (job) => {
      qc.setQueryData<Job[]>(queryKeys.jobs(user!.id), (prev) => (prev ? [job, ...prev] : [job]));
      void logActivity(user!.id, "job_saved", `Saved ${job.company}`, { jobId: job.id });
      // Manual entry can start a job past "saved" (e.g. logging one already applied to).
      logStatusTransition(user!.id, "saved", job);
      // A new job always writes at least one job_status_history row (the
      // trigger logs the initial save) — refresh Timeline's source so the
      // new entry shows up without waiting for the next natural refetch.
      qc.invalidateQueries({ queryKey: queryKeys.allJobStatusHistory(user!.id) });
    },
  });
}

export function useUpdateJob() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Job> }) => jobsService.updateJob(id, patch),
    onSuccess: (updated) => {
      const key = queryKeys.jobs(user!.id);
      const previous = qc.getQueryData<Job[]>(key)?.find((j) => j.id === updated.id);
      qc.setQueryData<Job[]>(key, (prev) => prev?.map((j) => (j.id === updated.id ? updated : j)));
      logStatusTransition(user!.id, previous?.status, updated);
      if (updated.ai_last_analyzed_at && updated.ai_last_analyzed_at !== previous?.ai_last_analyzed_at) {
        void logActivity(user!.id, "ai_analysis_run", `Analyzed fit for ${updated.company}`, { jobId: updated.id });
      }
      if (previous && previous.status !== updated.status) {
        qc.invalidateQueries({ queryKey: queryKeys.allJobStatusHistory(user!.id) });
      }
    },
  });
}

export function useDeleteJob() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jobsService.deleteJob(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<Job[]>(queryKeys.jobs(user!.id), (prev) => prev?.filter((j) => j.id !== id));
      // Deleting a job cascades to its job_status_history rows too — drop
      // them from Timeline's cache rather than leaving a ghost entry.
      qc.setQueryData<JobStatusHistoryEntry[]>(queryKeys.allJobStatusHistory(user!.id), (prev) =>
        prev?.filter((entry) => entry.job_id !== id)
      );
    },
  });
}

/**
 * Drag-and-drop status move. Optimistically updates the board immediately,
 * then persists via updateJobStatus — date_applied / interview_date /
 * offer_date / rejection_date are stamped server-side (trg_jobs_stamp_dates)
 * the first time status reaches that stage, and are never overwritten once
 * a date is already set. On error the optimistic change is rolled back.
 */
export function useMoveJob() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = queryKeys.jobs(user?.id ?? "");

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) => jobsService.updateJobStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Job[]>(key);
      qc.setQueryData<Job[]>(key, (prev) => prev?.map((j) => (j.id === id ? { ...j, status } : j)));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSuccess: (updated, _vars, context) => {
      qc.setQueryData<Job[]>(key, (prev) => prev?.map((j) => (j.id === updated.id ? updated : j)));
      const previousStatus = context?.previous?.find((j) => j.id === updated.id)?.status;
      logStatusTransition(user!.id, previousStatus, updated);
      // Board drag is the most common way a status changes — Timeline's
      // history rows need refreshing the same as any other status change.
      if (previousStatus && previousStatus !== updated.status) {
        qc.invalidateQueries({ queryKey: queryKeys.allJobStatusHistory(user!.id) });
      }
    },
  });
}

/** Persists a generated cover letter immediately — release-blocking: a
 * letter must never live only in component state, or it's lost the moment
 * the dialog closes without a full form save. */
export function useSaveCoverLetter() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = queryKeys.jobs(user?.id ?? "");

  return useMutation({
    mutationFn: ({ id, coverLetter, resumeId }: { id: string; coverLetter: string; resumeId: string | null }) =>
      jobsService.saveCoverLetter(id, coverLetter, resumeId),
    onSuccess: (updated) => {
      qc.setQueryData<Job[]>(key, (prev) => prev?.map((j) => (j.id === updated.id ? updated : j)));
    },
  });
}

/** The follow-up checkmark. Optimistic (clears the reminder immediately
 * everywhere that reads job.follow_up_date), rolls back visually if the
 * server rejects it. */
export function useCompleteFollowUp() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = queryKeys.jobs(user?.id ?? "");

  return useMutation({
    mutationFn: ({ id, nextRound }: { id: string; nextRound: number }) => jobsService.completeFollowUp(id, nextRound),
    onMutate: async ({ id, nextRound }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Job[]>(key);
      qc.setQueryData<Job[]>(key, (prev) =>
        prev?.map((j) => (j.id === id ? { ...j, follow_up_date: null, followed_up_at: new Date().toISOString(), follow_up_round: nextRound } : j))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSuccess: (updated) => {
      qc.setQueryData<Job[]>(key, (prev) => prev?.map((j) => (j.id === updated.id ? updated : j)));
    },
  });
}

/** The optional "schedule one final follow-up" offer after the first
 * completes — never invoked automatically past round 2. */
export function useScheduleAnotherFollowUp() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = queryKeys.jobs(user?.id ?? "");

  return useMutation({
    mutationFn: ({ id, followUpDate }: { id: string; followUpDate: string }) => jobsService.scheduleAnotherFollowUp(id, followUpDate),
    onSuccess: (updated) => {
      qc.setQueryData<Job[]>(key, (prev) => prev?.map((j) => (j.id === updated.id ? updated : j)));
    },
  });
}
