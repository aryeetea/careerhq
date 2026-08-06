import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import * as goalsService from "@/services/goals";
import { logActivity } from "@/services/activity";

export function useGoals() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.goals(userId),
    queryFn: () => goalsService.listGoals(userId),
    enabled: Boolean(userId),
  });
}

function useInvalidateGoals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.goals(user?.id ?? "") });
}

// Mounted once (see RealtimeSync) — a shared goal's progress moving, or
// someone joining/leaving one, reaches every participant's Dashboard and
// Goals page immediately. Unfiltered: goals_select/goal_members_select RLS
// already scopes delivery to goals this user owns or belongs to.
export function useGoalsRealtime() {
  const { user } = useAuth();
  const invalidate = useInvalidateGoals();
  const userId = user?.id ?? "";

  useRealtimeTable({
    channel: `goals:${userId}`,
    table: "goals",
    enabled: Boolean(userId),
    onChange: invalidate,
  });

  useRealtimeTable({
    channel: `goal-members:${userId}`,
    table: "goal_members",
    enabled: Boolean(userId),
    onChange: invalidate,
  });
}

export function useCreateGoal() {
  const { user } = useAuth();
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (input: goalsService.NewGoal) => goalsService.createGoal(user!.id, input),
    onSuccess: (goal) => {
      invalidate();
      void logActivity(user!.id, "goal_created", `Set a new goal: ${goal.name}`, { goalId: goal.id });
    },
  });
}

export function useUpdateGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof goalsService.updateGoal>[1] }) =>
      goalsService.updateGoal(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (id: string) => goalsService.deleteGoal(id),
    onSuccess: invalidate,
  });
}

export function useJoinGoal() {
  const { user } = useAuth();
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (goalId: string) => goalsService.joinGoal(goalId, user!.id),
    onSuccess: invalidate,
  });
}

export function useLeaveGoal() {
  const { user } = useAuth();
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (goalId: string) => goalsService.leaveGoal(goalId, user!.id),
    onSuccess: invalidate,
  });
}

export function useUpdateGoalProgress() {
  const { user } = useAuth();
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: ({ goalId, progressCount }: { goalId: string; progressCount: number }) =>
      goalsService.updateGoalProgress(goalId, user!.id, progressCount),
    onSuccess: invalidate,
  });
}
