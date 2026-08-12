-- =====================================================================
-- Bloom — profiles was the one domain 0038_realtime_and_followup_completion
-- missed when it added jobs/journal_entries/activity_events/friend_requests/
-- friendships/group_invites/group_members/goals/goal_members to the
-- supabase_realtime publication. Without this, useProfileRealtime()
-- (src/hooks/queries/useProfile.ts) subscribes client-side but Postgres
-- never actually broadcasts profiles changes — the subscription connects
-- and just sits there receiving nothing. This is why editing "Today's
-- thought" (or any profile field) in one tab/device never showed up in
-- another without a manual reload.
-- =====================================================================

alter publication supabase_realtime add table profiles;
