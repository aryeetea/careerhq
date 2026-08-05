import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as jobsService from "@/services/jobs";
import type { Job, JobStatus, NewJob } from "@/types/database";

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
    },
  });
}

export function useUpdateJob() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Job> }) => jobsService.updateJob(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData<Job[]>(queryKeys.jobs(user!.id), (prev) => prev?.map((j) => (j.id === updated.id ? updated : j)));
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
    onSuccess: (updated) => {
      qc.setQueryData<Job[]>(key, (prev) => prev?.map((j) => (j.id === updated.id ? updated : j)));
    },
  });
}
