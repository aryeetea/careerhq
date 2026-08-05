-- =====================================================================
-- CareerHQ — resolves minimal profile info (username/display_name/
-- avatar_url only — never career_goal, locations, or the weekly goal
-- number) for people the caller shares a goal or group with, so the UI
-- can show names on shared-goal and group member lists without opening
-- direct table access to `profiles`.
--
-- Run AFTER 0001, 0002, 0003.
-- =====================================================================

create or replace function get_shared_context_profiles(p_user_ids uuid[])
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
        select 1 from goal_members gm1
        join goal_members gm2 on gm1.goal_id = gm2.goal_id
        where gm1.user_id = p.id and gm2.user_id = auth.uid()
      )
      or exists (
        select 1 from group_members gm1
        join group_members gm2 on gm1.group_id = gm2.group_id
        where gm1.user_id = p.id and gm2.user_id = auth.uid()
      )
    );
$$;

grant execute on function get_shared_context_profiles(uuid[]) to authenticated;
