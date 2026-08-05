import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as certService from "@/services/certifications";
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
      qc.setQueryData<Certification[]>(queryKeys.certifications(user!.id), (prev) =>
        prev?.map((c) => (c.id === updated.id ? updated : c))
      );
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
