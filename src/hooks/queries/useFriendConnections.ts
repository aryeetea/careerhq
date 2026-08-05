import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as friendConnectionsService from "@/services/friendConnections";

export function useMutualConnections(friendId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.mutualConnections(friendId ?? ""),
    queryFn: () => friendConnectionsService.getMutualConnections(friendId as string),
    enabled: Boolean(friendId),
  });
}

export function useSuggestedFriends() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.suggestedFriends(userId),
    queryFn: () => friendConnectionsService.suggestFriends(),
    enabled: Boolean(userId),
  });
}
