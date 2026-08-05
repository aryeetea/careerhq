import type { GoalWithMembers } from "@/services/goals";

/** Goals the given user owns (not ones shared with them by a friend) that
 * they haven't yet completed — used by the Career Goal and Search Health
 * cards on Profile. */
export function getMyActiveGoals(goals: GoalWithMembers[], userId: string): GoalWithMembers[] {
  return goals.filter((g) => {
    if (g.owner_id !== userId) return false;
    const member = g.goal_members.find((m) => m.user_id === userId);
    const progress = member?.progress_count ?? 0;
    return progress < g.target_count;
  });
}

/** Picks the single most relevant active goal to feature as "current
 * milestone": nearest deadline first, otherwise most recently touched. */
export function pickCurrentGoal(goals: GoalWithMembers[]): GoalWithMembers | null {
  if (goals.length === 0) return null;
  const withDeadline = goals
    .filter((g) => g.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
  if (withDeadline.length > 0) return withDeadline[0];
  return [...goals].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
}
