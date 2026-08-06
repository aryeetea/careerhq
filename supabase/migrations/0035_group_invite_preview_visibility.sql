-- Bloom — Let a pending invitee see the group they've been invited to.
--
-- groups_select (0002_social_schema.sql) only allowed is_group_member(id,
-- auth.uid()) — correct for keeping a group's existence private in
-- general, but it meant an invitee couldn't see the group's own name or
-- description until AFTER joining, which is exactly backward: the old
-- Groups page worked around this by showing "You've been invited" with no
-- group name at all. The new unified Invites tab needs to actually say
-- which group.
--
-- Safe to extend: groups only has name/description/owner_id/
-- weekly_goal_target — nothing sensitive — and group_members (the actual
-- membership list) keeps its own, unchanged RLS, so this doesn't expose
-- who else is in the group, only the group's own name/description to
-- someone who's been explicitly invited into it.
alter policy groups_select on groups
  using (
    is_group_member(id, auth.uid())
    or exists (
      select 1 from group_invites gi
      where gi.group_id = groups.id and gi.invitee_id = auth.uid() and gi.status = 'pending'
    )
  );
