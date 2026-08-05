-- =====================================================================
-- CareerHQ — Fix 0005: revoke EXECUTE from the actual granted roles.
--
-- 0005_tighten_function_grants.sql ran `revoke execute ... from public`,
-- which assumes functions inherit EXECUTE through the PUBLIC pseudo-role.
-- On Supabase, new functions instead get direct ACL entries for
-- `anon`, `authenticated`, and `service_role` at creation time (confirmed
-- via pg_proc.proacl — there was no `=X/postgres` PUBLIC entry to begin
-- with). Revoking from PUBLIC was therefore a no-op: every function was
-- still fully executable by `anon` after 0005.
--
-- This migration revokes EXECUTE from `anon` (and, for functions with
-- no legitimate invoker at all, from `authenticated` too) directly,
-- then re-affirms the `authenticated` grants that must remain so
-- current app functionality — friend requests, group invites, friend
-- cards, shared-context profiles, username search, RLS policy checks
-- on goals/groups/reactions — keeps working.
--
-- Safe to re-run: every statement is idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Client-facing RPC endpoints — authenticated only, never anon.
-- ---------------------------------------------------------------------
revoke execute on function accept_friend_request(uuid) from public, anon;
grant execute on function accept_friend_request(uuid) to authenticated;

revoke execute on function accept_group_invite(uuid) from public, anon;
grant execute on function accept_group_invite(uuid) to authenticated;

revoke execute on function get_friend_card(uuid) from public, anon;
grant execute on function get_friend_card(uuid) to authenticated;

revoke execute on function get_shared_context_profiles(uuid[]) from public, anon;
grant execute on function get_shared_context_profiles(uuid[]) to authenticated;

revoke execute on function search_users_by_username(text) from public, anon;
grant execute on function search_users_by_username(text) to authenticated;

revoke execute on function sync_weekly_progress(uuid) from public, anon;
grant execute on function sync_weekly_progress(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS-policy helpers — evaluated under the querying (authenticated)
-- role when a client selects/inserts on goals, goal_members, groups,
-- group_members, group_invites, or encouragement_reactions.
-- ---------------------------------------------------------------------
revoke execute on function is_friend(uuid, uuid) from public, anon;
grant execute on function is_friend(uuid, uuid) to authenticated;

revoke execute on function is_blocked(uuid, uuid) from public, anon;
grant execute on function is_blocked(uuid, uuid) to authenticated;

revoke execute on function is_goal_member(uuid, uuid) from public, anon;
grant execute on function is_goal_member(uuid, uuid) to authenticated;

revoke execute on function is_group_member(uuid, uuid) from public, anon;
grant execute on function is_group_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Fully internal — only ever called from inside another SECURITY
-- DEFINER function's body (visibility_allows from get_friend_card;
-- compute_streak from sync_weekly_progress). Nested calls execute as
-- the outer function's owner, not the invoking role, so neither anon
-- nor authenticated needs direct EXECUTE.
-- ---------------------------------------------------------------------
revoke execute on function visibility_allows(uuid, uuid, visibility_level) from public, anon, authenticated;
revoke execute on function compute_streak(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Trigger-only functions — fired by the trigger manager under the
-- function owner's rights; no invoker EXECUTE grant is ever needed.
-- ---------------------------------------------------------------------
revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function set_updated_at() from public, anon, authenticated;
revoke execute on function jobs_stamp_status_dates() from public, anon, authenticated;
revoke execute on function jobs_log_status_change() from public, anon, authenticated;
revoke execute on function certifications_sync_status() from public, anon, authenticated;
revoke execute on function jobs_sync_weekly_progress() from public, anon, authenticated;
revoke execute on function goals_add_owner_member() from public, anon, authenticated;
revoke execute on function groups_add_owner_member() from public, anon, authenticated;
revoke execute on function notify_friend_request() from public, anon, authenticated;
revoke execute on function notify_reaction() from public, anon, authenticated;
revoke execute on function notify_group_invite() from public, anon, authenticated;
