import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as candidateFactsService from "@/services/candidateFacts";
import type { CandidateFactAnswer } from "@/types/database";

export function useCandidateFacts() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.candidateFacts(userId),
    queryFn: () => candidateFactsService.listCandidateFacts(userId),
    enabled: Boolean(userId),
  });
}

export function useUpsertCandidateFact() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { requirementKey: string; label: string; answer: CandidateFactAnswer; detail?: string | null }) =>
      candidateFactsService.upsertCandidateFact(user!.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.candidateFacts(user!.id) }),
  });
}

export function useDeleteCandidateFact() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requirementKey: string) => candidateFactsService.deleteCandidateFact(user!.id, requirementKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.candidateFacts(user!.id) }),
  });
}
