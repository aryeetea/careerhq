import { supabase } from "@/lib/supabase";
import type { Goal, GoalMember } from "@/types/database";

export interface GoalWithMembers extends Goal {
  goal_members: GoalMember[];
}

export async function listGoals(userId: string): Promise<GoalWithMembers[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("*, goal_members(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  // RLS already restricts to goals the user is a member of or that are
  // shared by a friend; userId kept in the signature for query-key hygiene.
  void userId;
  return data as GoalWithMembers[];
}

export type NewGoal = Pick<Goal, "name"> & Partial<Omit<Goal, "id" | "owner_id" | "created_at" | "updated_at">>;

export async function createGoal(ownerId: string, input: NewGoal): Promise<Goal> {
  const { data, error } = await supabase
    .from("goals")
    .insert({ ...input, owner_id: ownerId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Goal;
}

export async function updateGoal(id: string, patch: Partial<Goal>): Promise<Goal> {
  const { data, error } = await supabase.from("goals").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}

export async function joinGoal(goalId: string, userId: string): Promise<GoalMember> {
  const { data, error } = await supabase
    .from("goal_members")
    .insert({ goal_id: goalId, user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data as GoalMember;
}

export async function leaveGoal(goalId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("goal_members").delete().eq("goal_id", goalId).eq("user_id", userId);
  if (error) throw error;
}

export async function updateGoalProgress(goalId: string, userId: string, progressCount: number): Promise<GoalMember> {
  const { data, error } = await supabase
    .from("goal_members")
    .update({ progress_count: progressCount })
    .eq("goal_id", goalId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as GoalMember;
}

export async function incrementGoalProgress(goalId: string, userId: string, currentCount: number): Promise<GoalMember> {
  return updateGoalProgress(goalId, userId, currentCount + 1);
}
