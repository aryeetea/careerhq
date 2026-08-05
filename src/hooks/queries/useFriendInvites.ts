import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as friendInvitesService from "@/services/friendInvites";

export function useMyFriendInviteLinks() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.friendInviteLinks(userId),
    queryFn: () => friendInvitesService.listMyFriendInviteLinks(),
    enabled: Boolean(userId),
  });
}

function useInvalidateFriendInviteLinks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.friendInviteLinks(user?.id ?? "") });
}

export function useCreateFriendInviteLink() {
  const invalidate = useInvalidateFriendInviteLinks();
  return useMutation({
    mutationFn: (settings: friendInvitesService.FriendInviteLinkSettings) =>
      friendInvitesService.createFriendInviteLink(settings),
    onSuccess: invalidate,
  });
}

export function useDisableFriendInviteLink() {
  const invalidate = useInvalidateFriendInviteLinks();
  return useMutation({
    mutationFn: (id: string) => friendInvitesService.disableFriendInviteLink(id),
    onSuccess: invalidate,
  });
}

export function useRegenerateFriendInviteLink() {
  const invalidate = useInvalidateFriendInviteLinks();
  return useMutation({
    mutationFn: ({ id, settings }: { id: string; settings: friendInvitesService.FriendInviteLinkSettings }) =>
      friendInvitesService.regenerateFriendInviteLink(id, settings),
    onSuccess: invalidate,
  });
}

export function useFriendInviteLinkPreview(token: string | undefined) {
  return useQuery({
    queryKey: ["friend-invite-preview", token ?? ""],
    queryFn: () => friendInvitesService.previewFriendInviteLink(token as string),
    enabled: Boolean(token),
    retry: 0,
  });
}

export function useAcceptFriendInviteLink() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => friendInvitesService.acceptFriendInviteLink(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friendIds(user?.id ?? "") });
      qc.invalidateQueries({ queryKey: queryKeys.friendCards(user?.id ?? "") });
    },
  });
}

export function useMutualConnections(friendId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.mutualConnections(friendId ?? ""),
    queryFn: () => friendInvitesService.getMutualConnections(friendId as string),
    enabled: Boolean(friendId),
  });
}

export function useSuggestedFriends() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.suggestedFriends(userId),
    queryFn: () => friendInvitesService.suggestFriends(),
    enabled: Boolean(userId),
  });
}
