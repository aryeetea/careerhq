import { supabase } from "@/lib/supabase";
import type { PeopleProfileSimpleGroup, PeopleProfileView } from "@/types/database";

function asSimpleList(value: unknown): PeopleProfileSimpleGroup[] {
  return Array.isArray(value) ? (value as PeopleProfileSimpleGroup[]) : [];
}

function asGoalList(value: unknown): PeopleProfileView["shared_goals"] {
  return Array.isArray(value) ? (value as PeopleProfileView["shared_goals"]) : [];
}

export async function getPeopleProfile(userId: string, preview?: "friend" | "non_friend"): Promise<PeopleProfileView | null> {
  const { data, error } = await supabase.rpc("get_people_profile", {
    p_user_id: userId,
    p_preview: preview ?? null,
  });
  if (error) throw error;

  const row = ((data as PeopleProfileView[] | null) ?? [])[0] ?? null;
  if (!row) return null;

  return {
    ...row,
    shared_goals: asGoalList(row.shared_goals),
    mutual_groups: asSimpleList(row.mutual_groups),
    mutual_goals: asSimpleList(row.mutual_goals),
  };
}
