import { supabase } from "@/lib/supabase";
import type { Group, GroupInvite, GroupMember } from "@/types/database";

export interface GroupWithMembers extends Group {
  group_members: GroupMember[];
}

export async function listGroups(): Promise<GroupWithMembers[]> {
  const { data, error } = await supabase.from("groups").select("*, group_members(*)").order("created_at", { ascending: false });
  if (error) throw error;
  return data as GroupWithMembers[];
}

export async function getGroup(id: string): Promise<GroupWithMembers> {
  const { data, error } = await supabase.from("groups").select("*, group_members(*)").eq("id", id).single();
  if (error) throw error;
  return data as GroupWithMembers;
}

export type NewGroup = Pick<Group, "name"> & Partial<Omit<Group, "id" | "owner_id" | "created_at" | "updated_at">>;

export async function createGroup(ownerId: string, input: NewGroup): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .insert({ ...input, owner_id: ownerId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Group;
}

export async function updateGroup(id: string, patch: Partial<Group>): Promise<Group> {
  const { data, error } = await supabase.from("groups").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Group;
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await supabase.from("groups").delete().eq("id", id);
  if (error) throw error;
}

export async function inviteToGroup(groupId: string, inviterId: string, inviteeId: string): Promise<GroupInvite> {
  const { data, error } = await supabase
    .from("group_invites")
    .insert({ group_id: groupId, inviter_id: inviterId, invitee_id: inviteeId })
    .select("*")
    .single();
  if (error) throw error;
  return data as GroupInvite;
}

export async function listMyGroupInvites(userId: string): Promise<GroupInvite[]> {
  const { data, error } = await supabase
    .from("group_invites")
    .select("*")
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as GroupInvite[];
}

export async function acceptGroupInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_group_invite", { p_invite_id: inviteId });
  if (error) throw error;
}

export async function declineGroupInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from("group_invites").update({ status: "declined" }).eq("id", inviteId);
  if (error) throw error;
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  if (error) throw error;
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  return removeGroupMember(groupId, userId);
}
