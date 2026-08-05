-- Phase 2 (Profile redesign): the spec distinguishes three text fields
-- that were previously conflated into two:
--   - bio              permanent professional intro (unchanged)
--   - career_status    a longer-lived professional focus statement,
--                       e.g. "Open to Product Design opportunities" (NEW)
--   - status_message   today's quick, temporary thought — the existing
--                       "thought bubble" on the Profile page (unchanged)
-- Also adds `skills`, a simple tag list shown on the profile.
alter table profiles
  add column if not exists career_status text,
  add column if not exists skills text[] not null default '{}';

comment on column profiles.career_status is 'Longer-lived professional focus statement, distinct from the daily status_message "thought bubble".';

-- Extend the existing per-field privacy model to cover the new field,
-- private by default like everything else.
alter table privacy_settings
  add column if not exists career_status_visibility visibility_level not null default 'private';

-- get_friend_card's OUT columns change, so it must be dropped before
-- create-or-replace (Postgres won't let a replace alter the return shape).
drop function if exists get_friend_card(uuid);

create or replace function get_friend_card(p_user_id uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  status_message text,
  career_status text,
  applications_this_week integer,
  applications_this_month integer,
  weekly_goal integer,
  interviews_count integer,
  offers_count integer,
  current_streak integer,
  certification_name text,
  certification_percentage integer
)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  ps privacy_settings%rowtype;
  wk date := date_trunc('week', current_date)::date;
  wp weekly_progress%rowtype;
  monthly_count integer;
  cert record;
begin
  if not is_friend(p_user_id, viewer) then
    raise exception 'Not friends with this user';
  end if;

  select * into ps from privacy_settings where user_id = p_user_id;
  select * into wp from weekly_progress where weekly_progress.user_id = p_user_id and week_start = wk;

  select count(*) into monthly_count from jobs
  where jobs.user_id = p_user_id and date_applied >= date_trunc('month', current_date);

  select c.name, c.progress_percentage into cert from certifications c
  where c.user_id = p_user_id and c.status = 'in_progress'
  order by c.updated_at desc limit 1;

  return query select
    p_user_id,
    (select p.username from profiles p where p.id = p_user_id),
    (select p.display_name from profiles p where p.id = p_user_id),
    (select p.avatar_url from profiles p where p.id = p_user_id),
    case when visibility_allows(p_user_id, viewer, ps.status_message_visibility)
      then (select p.status_message from profiles p where p.id = p_user_id) else null end,
    case when visibility_allows(p_user_id, viewer, ps.career_status_visibility)
      then (select p.career_status from profiles p where p.id = p_user_id) else null end,
    case when visibility_allows(p_user_id, viewer, ps.weekly_count_visibility)
      then coalesce(wp.applications_count, 0) else null end,
    case when visibility_allows(p_user_id, viewer, ps.monthly_count_visibility)
      then coalesce(monthly_count, 0) else null end,
    case when visibility_allows(p_user_id, viewer, ps.weekly_count_visibility)
      then coalesce(wp.weekly_goal, 0) else null end,
    case when visibility_allows(p_user_id, viewer, ps.interview_count_visibility)
      then coalesce(wp.interviews_count, 0) else null end,
    case when visibility_allows(p_user_id, viewer, ps.offer_count_visibility)
      then coalesce(wp.offers_count, 0) else null end,
    case when visibility_allows(p_user_id, viewer, ps.streak_visibility)
      then coalesce(wp.current_streak, 0) else null end,
    case when visibility_allows(p_user_id, viewer, ps.certification_visibility)
      then cert.name else null end,
    case when visibility_allows(p_user_id, viewer, ps.certification_visibility)
      then cert.progress_percentage else null end;
end;
$$;

grant execute on function get_friend_card(uuid) to authenticated;
