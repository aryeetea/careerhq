import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as groupsService from "@/services/groups";

export function useGroups() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.groups(userId),
    queryFn: () => groupsService.listGroups(),
    enabled: Boolean(userId),
  });
}

export function useGroup(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.group(id ?? ""),
    queryFn: () => groupsService.getGroup(id as string),
    enabled: Boolean(id),
  });
}

export function useGroupJoinLinkPreview(token: string | undefined) {
  return useQuery({
    queryKey: ["group-join-preview", token ?? ""],
    queryFn: () => groupsService.previewGroupJoinLink(token as string),
    enabled: Boolean(token),
    retry: 0,
  });
}

export function useGroupInvites() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.groupInvites(userId),
    queryFn: () => groupsService.listMyGroupInvites(userId),
    enabled: Boolean(userId),
  });
}

function useInvalidateGroups() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return (groupId?: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.groups(user?.id ?? "") });
    qc.invalidateQueries({ queryKey: queryKeys.groupInvites(user?.id ?? "") });
    if (groupId) qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
  };
}

export function useCreateGroup() {
  const { user } = useAuth();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (input: groupsService.NewGroup) => groupsService.createGroup(user!.id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteGroup() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (id: string) => groupsService.deleteGroup(id),
    onSuccess: () => invalidate(),
  });
}

export function useInviteToGroup() {
  const { user } = useAuth();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({ groupId, inviteeId }: { groupId: string; inviteeId: string }) =>
      groupsService.inviteToGroup(groupId, user!.id, inviteeId),
    onSuccess: (_r, vars) => invalidate(vars.groupId),
  });
}

export function useAcceptGroupInvite() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (inviteId: string) => groupsService.acceptGroupInvite(inviteId),
    onSuccess: () => invalidate(),
  });
}

export function useDeclineGroupInvite() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (inviteId: string) => groupsService.declineGroupInvite(inviteId),
    onSuccess: () => invalidate(),
  });
}

export function useLeaveGroup() {
  const { user } = useAuth();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (groupId: string) => groupsService.leaveGroup(groupId, user!.id),
    onSuccess: (_r, groupId) => invalidate(groupId),
  });
}

export function useRemoveGroupMember() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) => groupsService.removeGroupMember(groupId, userId),
    onSuccess: (_r, vars) => invalidate(vars.groupId),
  });
}

export function useCreateGroupJoinLink() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (groupId: string) => groupsService.createGroupJoinLink(groupId),
    onSuccess: (result) => invalidate(result.group_id),
  });
}

export function useJoinGroupViaLink() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (token: string) => groupsService.joinGroupViaLink(token),
    onSuccess: (groupId) => invalidate(groupId),
  });
}
