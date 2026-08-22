import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as pushSubscriptionsService from "@/services/pushSubscriptions";

export function usePushSubscriptions() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.pushSubscriptions(userId),
    queryFn: () => pushSubscriptionsService.listPushSubscriptions(userId),
    enabled: Boolean(userId),
  });
}

export function useDeletePushSubscription() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pushSubscriptionsService.deletePushSubscriptionById(user!.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pushSubscriptions(user!.id) }),
  });
}
