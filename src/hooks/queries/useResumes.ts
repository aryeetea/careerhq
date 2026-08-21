import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import * as resumesService from "@/services/resumes";
import { logActivity } from "@/services/activity";
import type { Resume } from "@/types/database";

export function useResumes() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.resumes(userId),
    queryFn: () => resumesService.listResumes(userId),
    enabled: Boolean(userId),
  });
}

// Mounted once in RealtimeSync — a résumé uploaded, renamed, or removed on
// another device reaches this session's picker lists immediately, the same
// way jobs/goals/profile already do. Patches the same cache entry every
// mutation in this file writes to, so there's one source of truth regardless
// of which client changed it.
export function useResumesRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";

  useRealtimeTable<Resume>({
    channel: `resumes:${userId}`,
    table: "resumes",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: Boolean(userId),
    onChange: (payload) => {
      const key = queryKeys.resumes(userId);
      if (payload.eventType === "INSERT") {
        const resume = payload.new as Resume;
        qc.setQueryData<Resume[]>(key, (prev) => (prev?.some((r) => r.id === resume.id) ? prev : [resume, ...(prev ?? [])]));
      } else if (payload.eventType === "UPDATE") {
        const resume = payload.new as Resume;
        qc.setQueryData<Resume[]>(key, (prev) => prev?.map((r) => (r.id === resume.id ? resume : r)));
      } else if (payload.eventType === "DELETE") {
        const oldId = (payload.old as { id?: string }).id;
        if (oldId) qc.setQueryData<Resume[]>(key, (prev) => prev?.filter((r) => r.id !== oldId));
      }
    },
  });
}

export function useCreateResume() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: resumesService.CreateResumeInput) => resumesService.createResume(user!.id, input),
    onSuccess: (resume) => {
      qc.setQueryData<Resume[]>(queryKeys.resumes(user!.id), (prev) => (prev ? [resume, ...prev] : [resume]));
      void logActivity(user!.id, "resume_uploaded", `Uploaded ${resume.name}`, { resumeId: resume.id });
    },
  });
}

export function useUpdateResume() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Resume, "name" | "target_role" | "notes">> }) =>
      resumesService.updateResume(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData<Resume[]>(queryKeys.resumes(user!.id), (prev) => prev?.map((r) => (r.id === updated.id ? updated : r)));
    },
  });
}

export function useReplaceResumeFile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ resume, file }: { resume: Resume; file: File }) => resumesService.replaceResumeFile(user!.id, resume, file),
    onSuccess: (updated) => {
      qc.setQueryData<Resume[]>(queryKeys.resumes(user!.id), (prev) => prev?.map((r) => (r.id === updated.id ? updated : r)));
    },
  });
}

export function useDeleteResume() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resume: Resume) => resumesService.deleteResume(resume),
    onSuccess: (_void, resume) => {
      qc.setQueryData<Resume[]>(queryKeys.resumes(user!.id), (prev) => prev?.filter((r) => r.id !== resume.id));
    },
  });
}
