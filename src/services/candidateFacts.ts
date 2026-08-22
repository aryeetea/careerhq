import { supabase } from "@/lib/supabase";
import type { CandidateFactAnswer, CandidateHardRequirementFact } from "@/types/database";

export async function listCandidateFacts(userId: string): Promise<CandidateHardRequirementFact[]> {
  const { data, error } = await supabase
    .from("candidate_hard_requirement_facts")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CandidateHardRequirementFact[];
}

// Upserts on (user_id, requirement_key) — confirming the same requirement
// again (from a different job, or an intentional update) overwrites the
// prior answer rather than creating a duplicate. label is refreshed to
// whatever this posting called it, so Settings shows recognizable wording
// even though matching itself is keyed on requirement_key.
export async function upsertCandidateFact(
  userId: string,
  input: { requirementKey: string; label: string; answer: CandidateFactAnswer; detail?: string | null },
): Promise<CandidateHardRequirementFact> {
  const { data, error } = await supabase
    .from("candidate_hard_requirement_facts")
    .upsert(
      {
        user_id: userId,
        requirement_key: input.requirementKey,
        label: input.label,
        answer: input.answer,
        detail: input.detail?.trim() || null,
      },
      { onConflict: "user_id,requirement_key" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as CandidateHardRequirementFact;
}

export async function deleteCandidateFact(userId: string, requirementKey: string): Promise<void> {
  const { error } = await supabase
    .from("candidate_hard_requirement_facts")
    .delete()
    .eq("user_id", userId)
    .eq("requirement_key", requirementKey);
  if (error) throw error;
}
