-- =====================================================================
-- Bloom — close auth-only security-definer ACL regressions.
--
-- Recreate/replace of SECURITY DEFINER functions does not preserve the
-- earlier revokes from 0006. If a migration later does `create or replace
-- function ...` and only adds `grant execute ... to authenticated`, the
-- function can remain executable by `anon`/`public` via the default ACL.
--
-- This migration explicitly removes the default public/anon access from all
-- auth-only RPCs in the current schema and keeps `authenticated` as the only
-- direct invoker role for the user-facing RPCs below.
-- =====================================================================

-- Auth-only RPCs: not callable by anonymous visitors.
revoke execute on function accept_friend_request(uuid) from public, anon;
grant execute on function accept_friend_request(uuid) to authenticated;

revoke execute on function accept_group_invite(uuid) from public, anon;
grant execute on function accept_group_invite(uuid) to authenticated;

revoke execute on function get_friend_card(uuid) from public, anon;
grant execute on function get_friend_card(uuid) to authenticated;

revoke execute on function get_shared_context_profiles(uuid[]) from public, anon;
grant execute on function get_shared_context_profiles(uuid[]) to authenticated;

revoke execute on function get_visible_basic_profiles(uuid[]) from public, anon;
grant execute on function get_visible_basic_profiles(uuid[]) to authenticated;

revoke execute on function get_people_profile(uuid, text) from public, anon;
grant execute on function get_people_profile(uuid, text) to authenticated;

revoke execute on function search_users_by_username(text) from public, anon;
grant execute on function search_users_by_username(text) to authenticated;

revoke execute on function sync_weekly_progress(uuid) from public, anon;
grant execute on function sync_weekly_progress(uuid) to authenticated;

revoke execute on function get_mutual_connections(uuid) from public, anon;
grant execute on function get_mutual_connections(uuid) to authenticated;

revoke execute on function suggest_friends(integer) from public, anon;
grant execute on function suggest_friends(integer) to authenticated;

revoke execute on function create_friend_code() from public, anon;
grant execute on function create_friend_code() to authenticated;

revoke execute on function regenerate_friend_code(uuid) from public, anon;
grant execute on function regenerate_friend_code(uuid) to authenticated;

revoke execute on function revoke_friend_code(uuid) from public, anon;
grant execute on function revoke_friend_code(uuid) to authenticated;

revoke execute on function validate_friend_code(text) from public, anon;
grant execute on function validate_friend_code(text) to authenticated;

revoke execute on function use_friend_code(text) from public, anon;
grant execute on function use_friend_code(text) to authenticated;

-- RLS-policy helper functions: these are evaluated under the signed-in role,
-- so they must remain usable to authenticated and should never be callable by
-- anonymous clients.
revoke execute on function is_friend(uuid, uuid) from public, anon;
grant execute on function is_friend(uuid, uuid) to authenticated;

revoke execute on function is_blocked(uuid, uuid) from public, anon;
grant execute on function is_blocked(uuid, uuid) to authenticated;

revoke execute on function is_goal_member(uuid, uuid) from public, anon;
grant execute on function is_goal_member(uuid, uuid) to authenticated;

revoke execute on function is_group_member(uuid, uuid) from public, anon;
grant execute on function is_group_member(uuid, uuid) to authenticated;

-- Fully internal functions may never be called by app code or anonymous users.
revoke execute on function visibility_allows(uuid, uuid, visibility_level) from public, anon, authenticated;
revoke execute on function compute_streak(uuid) from public, anon, authenticated;
