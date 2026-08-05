import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as certService from "@/services/certifications";
import { logActivity } from "@/services/activity";
import type { Certification } from "@/types/database";

export function useCertifications() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.certifications(userId),
    queryFn: () => certService.listCertifications(userId),
    enabled: Boolean(userId),
  });
}

export function useCreateCertification() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, file }: { input: certService.NewCertification; file?: File | null }) =>
      certService.createCertification(user!.id, input, file),
    onSuccess: (cert) => {
      qc.setQueryData<Certification[]>(queryKeys.certifications(user!.id), (prev) => (prev ? [cert, ...prev] : [cert]));
      void logActivity(user!.id, "certification_added", `Added ${cert.name}`, { certificationId: cert.id });
    },
  });
}

export function useUpdateCertification() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch, file }: { id: string; patch: Partial<Certification>; file?: File | null }) =>
      certService.updateCertification(id, { ...patch, user_id: user!.id } as Certification, file),
    onSuccess: (updated) => {
      const key = queryKeys.certifications(user!.id);
      const previous = qc.getQueryData<Certification[]>(key)?.find((c) => c.id === updated.id);
      qc.setQueryData<Certification[]>(key, (prev) => prev?.map((c) => (c.id === updated.id ? updated : c)));
      if (updated.progress_percentage === 100 && previous?.progress_percentage !== 100) {
        void logActivity(user!.id, "certification_completed", `Completed ${updated.name}`, { certificationId: updated.id });
      }
    },
  });
}

export function useDeleteCertification() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cert: Certification) => certService.deleteCertification(cert),
    onSuccess: (_void, cert) => {
      qc.setQueryData<Certification[]>(queryKeys.certifications(user!.id), (prev) => prev?.filter((c) => c.id !== cert.id));
    },
  });
}
