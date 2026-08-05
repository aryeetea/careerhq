import { supabase } from "@/lib/supabase";
import type { ProfileActivity, ProfileActivityType } from "@/types/database";

export async function listActivity(userId: string, limit = 12): Promise<ProfileActivity[]> {
  const { data, error } = await supabase
    .from("profile_activity")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ProfileActivity[];
}

// Fire-and-forget: activity logging should never block or fail the mutation
// it's attached to. Swallows errors after a console warning.
export async function logActivity(
  userId: string,
  type: ProfileActivityType,
  title: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase.from("profile_activity").insert({ user_id: userId, type, title, metadata });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("Couldn't log profile activity", error);
  }
}
