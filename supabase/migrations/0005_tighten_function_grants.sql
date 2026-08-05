-- =====================================================================
-- CareerHQ — Tighten SECURITY DEFINER function grants.
--
-- `create function` grants EXECUTE to PUBLIC by default, which the
-- `anon` role inherits. That made every SECURITY DEFINER helper below
-- reachable by unauthenticated callers via PostgREST at
-- /rest/v1/rpc/<function_name> (flagged by the Supabase security
-- advisor as anon_security_definer_function_executable /
-- authenticated_security_definer_function_executable).
--
-- This migration revokes the PUBLIC grant on every SECURITY DEFINER
-- function in `public` and re-grants EXECUTE only where an authenticated
-- caller genuinely needs it — either a client `.rpc()` endpoint, or a
-- helper evaluated directly inside an RLS policy under the querying
-- role. Functions with neither use case lose PUBLIC entirely:
--
--  - Trigger-only functions (attached via `create trigger`) never need
--    an invoker EXECUTE grant — the trigger manager fires them under
--    the function owner's rights, not the session role's.
--  - Functions only ever called from inside another SECURITY DEFINER
--    function's body (never from an RLS policy, never via client
--    `.rpc()`) also run as that outer function's owner for the
--    duration of the nested call, so they need no invoker grant either.
--
-- Safe to re-run: every statement is idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Client-facing RPC endpoints — authenticated only, never anon.
-- (src/services/*.ts calls each of these via supabase.rpc(...).)
-- ---------------------------------------------------------------------
revoke execute on function accept_friend_request(uuid) from public;
grant execute on function accept_friend_request(uuid) to authenticated;

revoke execute on function accept_group_invite(uuid) from public;
grant execute on function accept_group_invite(uuid) to authenticated;

revoke execute on function get_friend_card(uuid) from public;
grant execute on function get_friend_card(uuid) to authenticated;

revoke execute on function get_shared_context_profiles(uuid[]) from public;
grant execute on function get_shared_context_profiles(uuid[]) to authenticated;

revoke execute on function search_users_by_username(text) from public;
grant execute on function search_users_by_username(text) to authenticated;

revoke execute on function sync_weekly_progress(uuid) from public;
grant execute on function sync_weekly_progress(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS-policy helpers — called directly inside USING/WITH CHECK clauses
-- on goals, goal_members, groups, group_members, group_invites, and
-- encouragement_reactions. Those policies run under the querying
-- role (authenticated), so authenticated must keep EXECUTE or the
-- policy evaluation fails with "permission denied for function".
-- ---------------------------------------------------------------------
revoke execute on function is_friend(uuid, uuid) from public;
grant execute on function is_friend(uuid, uuid) to authenticated;

revoke execute on function is_blocked(uuid, uuid) from public;
grant execute on function is_blocked(uuid, uuid) to authenticated;

revoke execute on function is_goal_member(uuid, uuid) from public;
grant execute on function is_goal_member(uuid, uuid) to authenticated;

revoke execute on function is_group_member(uuid, uuid) from public;
grant execute on function is_group_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Fully internal — only ever called from inside another SECURITY
-- DEFINER function's body (visibility_allows from get_friend_card;
-- compute_streak from sync_weekly_progress). Never in an RLS policy,
-- never via client .rpc(). PUBLIC dropped entirely, no re-grant.
-- ---------------------------------------------------------------------
revoke execute on function visibility_allows(uuid, uuid, visibility_level) from public;
revoke execute on function compute_streak(uuid) from public;

-- ---------------------------------------------------------------------
-- Trigger-only functions — fired by the trigger manager under the
-- function owner's rights, never invoked directly. PUBLIC dropped
-- entirely, no re-grant.
-- ---------------------------------------------------------------------
revoke execute on function handle_new_user() from public;
revoke execute on function set_updated_at() from public;
revoke execute on function jobs_stamp_status_dates() from public;
revoke execute on function jobs_log_status_change() from public;
revoke execute on function certifications_sync_status() from public;
revoke execute on function jobs_sync_weekly_progress() from public;
revoke execute on function goals_add_owner_member() from public;
revoke execute on function groups_add_owner_member() from public;
revoke execute on function notify_friend_request() from public;
revoke execute on function notify_reaction() from public;
revoke execute on function notify_group_invite() from public;
