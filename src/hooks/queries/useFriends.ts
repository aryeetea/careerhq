import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as friendsService from "@/services/friends";

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.userSearch(query),
    queryFn: () => friendsService.searchUsersByUsername(query),
    enabled: query.trim().length >= 2,
  });
}

export function useFriendIds() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.friendIds(userId),
    queryFn: () => friendsService.listFriendIds(userId),
    enabled: Boolean(userId),
  });
}

export function useFriendCards() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const friendIdsQuery = useFriendIds();
  return useQuery({
    queryKey: queryKeys.friendCards(userId),
    queryFn: () => friendsService.getFriendCards(friendIdsQuery.data ?? []),
    enabled: Boolean(userId) && Boolean(friendIdsQuery.data),
  });
}

export function useIncomingRequests() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.incomingRequests(userId),
    queryFn: () => friendsService.listIncomingRequests(userId),
    enabled: Boolean(userId),
  });
}

export function useOutgoingRequests() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.outgoingRequests(userId),
    queryFn: () => friendsService.listOutgoingRequests(userId),
    enabled: Boolean(userId),
  });
}

export function useBlockedUsers() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.blockedUsers(userId),
    queryFn: () => friendsService.listBlockedUsers(userId),
    enabled: Boolean(userId),
  });
}

function useInvalidateFriendData() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.friendIds(userId) });
    qc.invalidateQueries({ queryKey: queryKeys.friendCards(userId) });
    qc.invalidateQueries({ queryKey: queryKeys.incomingRequests(userId) });
    qc.invalidateQueries({ queryKey: queryKeys.outgoingRequests(userId) });
    qc.invalidateQueries({ queryKey: queryKeys.blockedUsers(userId) });
  };
}

export function useSendFriendRequest() {
  const invalidate = useInvalidateFriendData();
  return useMutation({
    mutationFn: (recipientId: string) => friendsService.sendFriendRequest(recipientId),
    onSuccess: invalidate,
  });
}

export function useAcceptFriendRequest() {
  const invalidate = useInvalidateFriendData();
  return useMutation({
    mutationFn: (requestId: string) => friendsService.acceptFriendRequest(requestId),
    onSuccess: invalidate,
  });
}

export function useDeclineFriendRequest() {
  const invalidate = useInvalidateFriendData();
  return useMutation({
    mutationFn: (requestId: string) => friendsService.declineFriendRequest(requestId),
    onSuccess: invalidate,
  });
}

export function useCancelFriendRequest() {
  const invalidate = useInvalidateFriendData();
  return useMutation({
    mutationFn: (requestId: string) => friendsService.cancelFriendRequest(requestId),
    onSuccess: invalidate,
  });
}

export function useRemoveFriend() {
  const { user } = useAuth();
  const invalidate = useInvalidateFriendData();
  return useMutation({
    mutationFn: (friendId: string) => friendsService.removeFriend(user!.id, friendId),
    onSuccess: invalidate,
  });
}

export function useBlockUser() {
  const { user } = useAuth();
  const invalidate = useInvalidateFriendData();
  return useMutation({
    mutationFn: (blockedId: string) => friendsService.blockUser(user!.id, blockedId),
    onSuccess: invalidate,
  });
}

export function useUnblockUser() {
  const { user } = useAuth();
  const invalidate = useInvalidateFriendData();
  return useMutation({
    mutationFn: (blockedId: string) => friendsService.unblockUser(user!.id, blockedId),
    onSuccess: invalidate,
  });
}
