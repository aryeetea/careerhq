-- Covering indexes for foreign keys flagged by the Supabase performance
-- advisor. Purely additive — no behavior change, just faster joins/lookups
-- on columns that are already foreign keys (friend requests, group
-- membership, activity feed, journal group visibility, etc.), several of
-- which are now also filtered on by the realtime layer's RLS checks.
create index if not exists idx_activity_events_actor_id on activity_events(actor_id);
create index if not exists idx_encouragement_reactions_sender_id on encouragement_reactions(sender_id);
create index if not exists idx_friend_code_events_code_id on friend_code_events(code_id);
create index if not exists idx_goal_members_user_id on goal_members(user_id);
create index if not exists idx_goals_owner_id on goals(owner_id);
create index if not exists idx_group_invites_invitee_id on group_invites(invitee_id);
create index if not exists idx_group_invites_inviter_id on group_invites(inviter_id);
create index if not exists idx_group_join_links_created_by on group_join_links(created_by);
create index if not exists idx_group_members_user_id on group_members(user_id);
create index if not exists idx_groups_owner_id on groups(owner_id);
create index if not exists idx_job_status_history_user_id on job_status_history(user_id);
create index if not exists idx_jobs_ai_recommended_resume_id on jobs(ai_recommended_resume_id);
create index if not exists idx_journal_entries_group_id on journal_entries(group_id);
create index if not exists idx_privacy_selected_friends_friend_id on privacy_selected_friends(friend_id);
create index if not exists idx_settings_default_resume_id on settings(default_resume_id);
create index if not exists idx_user_blocks_blocked_id on user_blocks(blocked_id);
