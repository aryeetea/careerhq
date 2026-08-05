-- Resolves minimal display info for users the caller is allowed to see in
-- lightweight social surfaces like pending friend requests and notification
-- actor labels. This intentionally exposes only username/display_name/avatar.
create or replace function get_visible_basic_profiles(p_user_ids uuid[])
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from profiles p
  where p.id = any(p_user_ids)
    and (
      p.id = auth.uid()
      or is_friend(p.id, auth.uid())
      or exists (
        select 1
        from friend_requests fr
        where fr.status = 'pending'
          and (
            (fr.requester_id = p.id and fr.recipient_id = auth.uid())
            or (fr.requester_id = auth.uid() and fr.recipient_id = p.id)
          )
      )
      or exists (
        select 1
        from group_invites gi
        where gi.status = 'pending'
          and (
            (gi.inviter_id = p.id and gi.invitee_id = auth.uid())
            or (gi.inviter_id = auth.uid() and gi.invitee_id = p.id)
          )
      )
    );
$$;

grant execute on function get_visible_basic_profiles(uuid[]) to authenticated;
