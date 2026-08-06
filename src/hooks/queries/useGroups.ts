import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
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

export function useGroupPreviews(groupIds: string[]) {
  const sorted = [...groupIds].sort();
  return useQuery({
    queryKey: ["group-previews", sorted],
    queryFn: () => groupsService.getGroupPreviews(sorted),
    enabled: sorted.length > 0,
    select: (rows) => new Map(rows.map((r) => [r.id, r])),
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

export function useSentGroupInvites() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.sentGroupInvites(userId),
    queryFn: () => groupsService.listSentGroupInvites(userId),
    enabled: Boolean(userId),
  });
}

function useInvalidateGroups() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return (groupId?: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.groups(user?.id ?? "") });
    qc.invalidateQueries({ queryKey: queryKeys.groupInvites(user?.id ?? "") });
    qc.invalidateQueries({ queryKey: queryKeys.sentGroupInvites(user?.id ?? "") });
    if (groupId) qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
  };
}

// Mounted once (see RealtimeSync) — an invite arriving, a member joining or
// leaving, or being removed from a group all land without a refresh.
// Unfiltered: group_invites/group_members RLS already scopes delivery to
// rows this user is a party to or a member of.
export function useGroupsRealtime() {
  const { user } = useAuth();
  const invalidate = useInvalidateGroups();
  const userId = user?.id ?? "";

  useRealtimeTable({
    channel: `group-invites:${userId}`,
    table: "group_invites",
    enabled: Boolean(userId),
    onChange: () => invalidate(),
  });

  useRealtimeTable({
    channel: `group-members:${userId}`,
    table: "group_members",
    enabled: Boolean(userId),
    onChange: () => invalidate(),
  });
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

export function useCancelGroupInvite() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (inviteId: string) => groupsService.cancelGroupInvite(inviteId),
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
