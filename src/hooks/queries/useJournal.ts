import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as journalService from "@/services/journal";
import type { JournalEntry } from "@/types/database";

export function useJournalEntries() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.journalEntries(userId),
    queryFn: () => journalService.listJournalEntries(userId),
    enabled: Boolean(userId),
  });
}

function useInvalidateJournal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.journalEntries(user?.id ?? "") });
}

export function useCreateJournalEntry() {
  const { user } = useAuth();
  const invalidate = useInvalidateJournal();
  return useMutation({
    mutationFn: (input: journalService.NewJournalEntry) => journalService.createJournalEntry(user!.id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateJournalEntry() {
  const invalidate = useInvalidateJournal();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<JournalEntry> }) => journalService.updateJournalEntry(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteJournalEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => journalService.deleteJournalEntry(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<JournalEntry[]>(queryKeys.journalEntries(user!.id), (prev) => prev?.filter((e) => e.id !== id));
    },
  });
}
