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

  // The RPC always returns exactly one row for a signed-in caller — either
  // the viewable profile or a row carrying only a deny_reason. A missing
  // row here would mean the caller wasn't authenticated at all; treat that
  // the same as "not found" rather than surfacing a blank page.
  const row = ((data as PeopleProfileView[] | null) ?? [])[0] ?? null;
  if (!row) return { ...NOT_FOUND_ROW, user_id: userId };

  return {
    ...row,
    shared_goals: asGoalList(row.shared_goals),
    mutual_groups: asSimpleList(row.mutual_groups),
    mutual_goals: asSimpleList(row.mutual_goals),
  };
}

const NOT_FOUND_ROW: PeopleProfileView = {
  user_id: "",
  username: "",
  display_name: "",
  avatar_url: null,
  bio: null,
  career_goal: null,
  career_status: null,
  status_message: null,
  relationship: "non_friend_preview",
  applications_this_week: null,
  applications_this_month: null,
  weekly_goal: null,
  interviews_count: null,
  offers_count: null,
  current_streak: null,
  certification_name: null,
  certification_percentage: null,
  shared_goals: [],
  mutual_groups: [],
  mutual_goals: [],
  deny_reason: "not_found",
};
