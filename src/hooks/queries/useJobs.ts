import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as jobsService from "@/services/jobs";
import { logActivity } from "@/services/activity";
import type { Job, JobStatus, NewJob } from "@/types/database";

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

export function useJobStatusHistory(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.jobStatusHistory(jobId ?? ""),
    queryFn: () => jobsService.listJobStatusHistory(jobId as string),
    enabled: Boolean(jobId),
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
    },
  });
}
