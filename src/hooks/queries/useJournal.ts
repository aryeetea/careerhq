import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
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

// Mounted once (see RealtimeSync). Edits/deletes on this device or another
// reach every open tab without a refresh; a privacy change on an entry
// currently isn't visible from here (this list is already scoped to
// user_id=eq.<uuid>) so no client-side filtering is involved.
export function useJournalRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";

  useRealtimeTable<JournalEntry>({
    channel: `journal:${userId}`,
    table: "journal_entries",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: Boolean(userId),
    onChange: (payload) => {
      const key = queryKeys.journalEntries(userId);
      if (payload.eventType === "INSERT") {
        const entry = payload.new as JournalEntry;
        qc.setQueryData<JournalEntry[]>(key, (prev) => (prev?.some((e) => e.id === entry.id) ? prev : [entry, ...(prev ?? [])]));
      } else if (payload.eventType === "UPDATE") {
        const entry = payload.new as JournalEntry;
        qc.setQueryData<JournalEntry[]>(key, (prev) => prev?.map((e) => (e.id === entry.id ? entry : e)));
      } else if (payload.eventType === "DELETE") {
        const oldId = (payload.old as { id?: string }).id;
        if (oldId) qc.setQueryData<JournalEntry[]>(key, (prev) => prev?.filter((e) => e.id !== oldId));
      }
    },
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
