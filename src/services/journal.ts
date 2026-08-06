import { supabase } from "@/lib/supabase";
import type { JournalEntry } from "@/types/database";

export type NewJournalEntry = Pick<JournalEntry, "body"> &
  Partial<Pick<JournalEntry, "title" | "mood" | "visibility" | "group_id" | "entry_date">>;

export async function listJournalEntries(userId: string): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as JournalEntry[];
}

export async function createJournalEntry(userId: string, input: NewJournalEntry): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({ ...input, user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data as JournalEntry;
}

export async function updateJournalEntry(id: string, patch: Partial<JournalEntry>): Promise<JournalEntry> {
  const { id: _omit, user_id: _omit2, created_at: _omit3, ...safePatch } = patch as JournalEntry;
  const { data, error } = await supabase.from("journal_entries").update(safePatch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as JournalEntry;
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) throw error;
}
