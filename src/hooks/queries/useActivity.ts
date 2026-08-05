import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as activityService from "@/services/activity";

export function useRecentActivity(limit = 12) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: [...queryKeys.profileActivity(userId), limit] as const,
    queryFn: () => activityService.listActivity(userId, limit),
    enabled: Boolean(userId),
  });
}
