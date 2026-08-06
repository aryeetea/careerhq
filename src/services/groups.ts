import { supabase } from "@/lib/supabase";
import type { Group, GroupInvite, GroupJoinLink, GroupJoinLinkPreview, GroupMember } from "@/types/database";

export interface GroupWithMembers extends Group {
  group_members: GroupMember[];
}

// "My Groups" has to mean groups you've actually joined — not just groups
// you're allowed to see a preview of. groups_select (0035) intentionally
// widened visibility so a pending invitee can see the group's own name
// before accepting, but that means plain RLS-scoped visibility is no
// longer the same thing as membership. `my_membership` is an inner-joined
// second alias of the same relationship used only to constrain which
// groups come back; `group_members` alongside it stays a full, unfiltered
// embed so the member count on each card is still accurate.
export async function listGroups(): Promise<GroupWithMembers[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("groups")
    .select("*, group_members(*), my_membership:group_members!inner(user_id)")
    .eq("my_membership.user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as GroupWithMembers[];
}

export async function getGroup(id: string): Promise<GroupWithMembers> {
  const { data, error } = await supabase.from("groups").select("*, group_members(*)").eq("id", id).single();
  if (error) throw error;
  return data as GroupWithMembers;
}

export interface GroupPreview {
  id: string;
  name: string;
  description: string | null;
}

// Just enough to label a pending invite ("invited to <name>") — never the
// member list. Relies on 0035_group_invite_preview_visibility.sql, which
// lets a pending invitee see this much about a group before joining it.
export async function getGroupPreviews(groupIds: string[]): Promise<GroupPreview[]> {
  if (groupIds.length === 0) return [];
  const { data, error } = await supabase.from("groups").select("id,name,description").in("id", groupIds);
  if (error) throw error;
  return data as GroupPreview[];
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

// Invites this person SENT that are still awaiting a reply — the mirror of
// listMyGroupInvites (which is invites sent TO them). group_invites_select
// already lets an inviter see their own sent rows regardless of the
// invitee's identity, so no RLS changes were needed for this.
export async function listSentGroupInvites(userId: string): Promise<GroupInvite[]> {
  const { data, error } = await supabase
    .from("group_invites")
    .select("*")
    .eq("inviter_id", userId)
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

// The inviter withdrawing their own still-pending invite — group_invites_update
// allows this since auth.uid() = inviter_id satisfies its USING/WITH CHECK
// clause, the same way cancelFriendRequest works for friend_requests.
export async function cancelGroupInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from("group_invites").update({ status: "cancelled" }).eq("id", inviteId);
  if (error) throw error;
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  if (error) throw error;
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  return removeGroupMember(groupId, userId);
}

export async function createGroupJoinLink(groupId: string): Promise<GroupJoinLink> {
  const { data, error } = await supabase
    .from("group_join_links")
    .insert({ group_id: groupId })
    .select("*")
    .single();
  if (error) throw error;
  return data as GroupJoinLink;
}

export async function previewGroupJoinLink(token: string): Promise<GroupJoinLinkPreview | null> {
  const { data, error } = await supabase.rpc("preview_group_join_link", { p_token: token });
  if (error) throw error;
  return ((data as GroupJoinLinkPreview[] | null) ?? [])[0] ?? null;
}

export async function joinGroupViaLink(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_group_via_link", { p_token: token });
  if (error) throw error;
  return data as string;
}
