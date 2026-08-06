import type { GoalWithMembers } from "@/services/goals";

// Keyword -> canonical unit, checked in order (first match wins) so a
// phrase like "apply to 25 jobs" maps to "applications" rather than a
// literal, slightly-off "jobs". Order matters: more specific phrases
// before their generic parents.
const UNIT_KEYWORDS: Array<[RegExp, string]> = [
  [/\bapplications?\b|\bapply\b|\bapplied\b|\bjobs?\b/i, "applications"],
  [/\binterviews?\b/i, "interviews"],
  [/\brecruiters?\b/i, "recruiters"],
  [/\blessons?\b|\bcourses?\b|\bmodules?\b/i, "lessons"],
  [/\bconnections?\b|\bnetworking\b/i, "connections"],
  [/\bfollow[\s-]?ups?\b/i, "follow-ups"],
];

export interface ParsedGoal {
  targetCount: number | null;
  unit: string | null;
}

/** Reads a target count and unit straight out of what someone typed as
 * their goal ("Apply to 25 jobs this week" -> {targetCount: 25, unit:
 * "applications"}) so they never have to re-enter the same numbers in a
 * separate field. Returns nulls when nothing usable is found — callers
 * should leave existing values alone in that case, not clear them. */
export function parseGoalText(text: string): ParsedGoal {
  const numberMatch = text.match(/\d+/);
  const targetCount = numberMatch ? parseInt(numberMatch[0], 10) : null;

  let unit: string | null = null;
  for (const [pattern, canonical] of UNIT_KEYWORDS) {
    if (pattern.test(text)) {
      unit = canonical;
      break;
    }
  }

  return { targetCount, unit };
}

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
