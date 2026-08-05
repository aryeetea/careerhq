-- get_people_profile's `user_id` OUT column shadows privacy_settings.user_id,
-- weekly_progress.user_id, and jobs.user_id when referenced unqualified
-- inside the function body, so Postgres can't tell which one a bare
-- `user_id` means (42702, "column reference is ambiguous"). Same bug class
-- as 0020's regenerate_friend_code fix — qualify every reference.
--
-- Also: certifications.progress_percentage is smallint, but the function
-- declares certification_percentage as integer — Postgres checks the
-- static return type of `return query select ...`, so this fails on every
-- call that reaches the final select, not just ones with a real in-progress
-- certification. Cast it explicitly.
create or replace function get_people_profile(p_user_id uuid, p_preview text default null)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  career_goal text,
  career_status text,
  status_message text,
  relationship text,
  applications_this_week integer,
  applications_this_month integer,
  weekly_goal integer,
  interviews_count integer,
  offers_count integer,
  current_streak integer,
  certification_name text,
  certification_percentage integer,
  shared_goals jsonb,
  mutual_groups jsonb,
  mutual_goals jsonb,
  deny_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  owner_profile profiles%rowtype;
  ps privacy_settings%rowtype;
  wp weekly_progress%rowtype;
  wk date := date_trunc('week', current_date)::date;
  monthly_count integer := 0;
  cert record;
  relation text := 'none';
  allow_profile_fields boolean := false;
  allow_career_status boolean := false;
  allow_status_message boolean := false;
  allow_weekly boolean := false;
  allow_monthly boolean := false;
  allow_interviews boolean := false;
  allow_offers boolean := false;
  allow_streak boolean := false;
  allow_certification boolean := false;
  shared_goals_json jsonb := '[]'::jsonb;
  mutual_groups_json jsonb := '[]'::jsonb;
  mutual_goals_json jsonb := '[]'::jsonb;
begin
  if viewer is null then
    return query select
      null::uuid, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text,
      null::integer, null::integer, null::integer, null::integer, null::integer, null::integer,
      null::text, null::integer, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'not_found'::text;
    return;
  end if;

  select * into owner_profile
  from profiles
  where id = p_user_id;

  if owner_profile.id is null then
    return query select
      null::uuid, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text,
      null::integer, null::integer, null::integer, null::integer, null::integer, null::integer,
      null::text, null::integer, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'not_found'::text;
    return;
  end if;

  if is_blocked(p_user_id, viewer) then
    return query select
      null::uuid, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text,
      null::integer, null::integer, null::integer, null::integer, null::integer, null::integer,
      null::text, null::integer, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'blocked'::text;
    return;
  end if;

  select * into ps
  from privacy_settings
  where privacy_settings.user_id = p_user_id;

  if ps.user_id is null then
    insert into privacy_settings (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select * into ps
    from privacy_settings
    where privacy_settings.user_id = p_user_id;
  end if;

  if viewer = p_user_id then
    if p_preview = 'friend' then
      relation := 'friend_preview';
    elsif p_preview = 'non_friend' then
      relation := 'non_friend_preview';
    else
      relation := 'self';
    end if;
  elsif is_friend(p_user_id, viewer) then
    relation := 'friend';
  elsif exists (
    select 1 from friend_requests
    where requester_id = p_user_id and recipient_id = viewer and status = 'pending'
  ) then
    relation := 'incoming_request';
  elsif exists (
    select 1 from friend_requests
    where requester_id = viewer and recipient_id = p_user_id and status = 'pending'
  ) then
    relation := 'outgoing_request';
  elsif exists (
    select 1
    from group_members gm_owner
    join group_members gm_viewer on gm_owner.group_id = gm_viewer.group_id
    where gm_owner.user_id = p_user_id and gm_viewer.user_id = viewer
  ) then
    relation := 'group_member';
  end if;

  if relation = 'none' then
    return query select
      null::uuid, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text,
      null::integer, null::integer, null::integer, null::integer, null::integer, null::integer,
      null::text, null::integer, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'no_access'::text;
    return;
  end if;

  select * into wp
  from weekly_progress
  where weekly_progress.user_id = p_user_id and week_start = wk;

  select count(*) into monthly_count
  from jobs
  where jobs.user_id = p_user_id
    and date_applied >= date_trunc('month', current_date);

  select c.name, c.progress_percentage into cert
  from certifications c
  where c.user_id = p_user_id
    and c.status = 'in_progress'
  order by c.updated_at desc
  limit 1;

  mutual_groups_json := coalesce((
    select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.created_at desc)
    from (
      select distinct g.id, g.name, g.created_at
      from groups g
      join group_members gm_owner on gm_owner.group_id = g.id and gm_owner.user_id = p_user_id
      join group_members gm_viewer on gm_viewer.group_id = g.id and gm_viewer.user_id = viewer
    ) g
  ), '[]'::jsonb);

  mutual_goals_json := coalesce((
    select jsonb_agg(jsonb_build_object('id', goal.id, 'name', goal.name) order by goal.created_at desc)
    from (
      select distinct g.id, g.name, g.created_at
      from goals g
      join goal_members gm_owner on gm_owner.goal_id = g.id and gm_owner.user_id = p_user_id
      join goal_members gm_viewer on gm_viewer.goal_id = g.id and gm_viewer.user_id = viewer
      where g.is_shared
    ) goal
  ), '[]'::jsonb);

  shared_goals_json := coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'description', g.description,
        'target_count', g.target_count,
        'unit', g.unit,
        'deadline', g.deadline
      )
      order by g.created_at desc
    )
    from goals g
    where g.owner_id = p_user_id
      and g.is_shared
      and (
        relation in ('self', 'friend', 'friend_preview')
        or exists (
          select 1
          from goal_members gm_owner
          join goal_members gm_viewer on gm_owner.goal_id = gm_viewer.goal_id
          where gm_owner.goal_id = g.id
            and gm_owner.user_id = p_user_id
            and gm_viewer.user_id = viewer
        )
      )
  ), '[]'::jsonb);

  allow_profile_fields := case
    when relation = 'self' then true
    when relation = 'friend' then owner_profile.sharing_enabled and visibility_allows(p_user_id, viewer, ps.profile_visibility)
    when relation = 'friend_preview' then owner_profile.sharing_enabled and ps.profile_visibility = 'friends_only'
    else false
  end;

  allow_career_status := case
    when relation = 'self' then true
    when relation = 'friend' then owner_profile.sharing_enabled and visibility_allows(p_user_id, viewer, ps.career_status_visibility)
    when relation = 'friend_preview' then owner_profile.sharing_enabled and ps.career_status_visibility = 'friends_only'
    else false
  end;

  allow_status_message := case
    when relation = 'self' then true
    when relation = 'friend' then owner_profile.sharing_enabled and visibility_allows(p_user_id, viewer, ps.status_message_visibility)
    when relation = 'friend_preview' then owner_profile.sharing_enabled and ps.status_message_visibility = 'friends_only'
    else false
  end;

  allow_weekly := case
    when relation = 'self' then true
    when relation = 'friend' then owner_profile.sharing_enabled and visibility_allows(p_user_id, viewer, ps.weekly_count_visibility)
    when relation = 'friend_preview' then owner_profile.sharing_enabled and ps.weekly_count_visibility = 'friends_only'
    else false
  end;

  allow_monthly := case
    when relation = 'self' then true
    when relation = 'friend' then owner_profile.sharing_enabled and visibility_allows(p_user_id, viewer, ps.monthly_count_visibility)
    when relation = 'friend_preview' then owner_profile.sharing_enabled and ps.monthly_count_visibility = 'friends_only'
    else false
  end;

  allow_interviews := case
    when relation = 'self' then true
    when relation = 'friend' then owner_profile.sharing_enabled and visibility_allows(p_user_id, viewer, ps.interview_count_visibility)
    when relation = 'friend_preview' then owner_profile.sharing_enabled and ps.interview_count_visibility = 'friends_only'
    else false
  end;

  allow_offers := case
    when relation = 'self' then true
    when relation = 'friend' then owner_profile.sharing_enabled and visibility_allows(p_user_id, viewer, ps.offer_count_visibility)
    when relation = 'friend_preview' then owner_profile.sharing_enabled and ps.offer_count_visibility = 'friends_only'
    else false
  end;

  allow_streak := case
    when relation = 'self' then true
    when relation = 'friend' then owner_profile.sharing_enabled and visibility_allows(p_user_id, viewer, ps.streak_visibility)
    when relation = 'friend_preview' then owner_profile.sharing_enabled and ps.streak_visibility = 'friends_only'
    else false
  end;

  allow_certification := case
    when relation = 'self' then true
    when relation = 'friend' then owner_profile.sharing_enabled and visibility_allows(p_user_id, viewer, ps.certification_visibility)
    when relation = 'friend_preview' then owner_profile.sharing_enabled and ps.certification_visibility = 'friends_only'
    else false
  end;

  return query
  select
    owner_profile.id,
    owner_profile.username,
    owner_profile.display_name,
    owner_profile.avatar_url,
    case when allow_profile_fields then owner_profile.bio else null end,
    case when allow_profile_fields then owner_profile.career_goal else null end,
    case when allow_career_status then owner_profile.career_status else null end,
    case when allow_status_message then owner_profile.status_message else null end,
    relation,
    case when allow_weekly then coalesce(wp.applications_count, 0) else null end,
    case when allow_monthly then coalesce(monthly_count, 0) else null end,
    case when allow_weekly then coalesce(wp.weekly_goal, 0) else null end,
    case when allow_interviews then coalesce(wp.interviews_count, 0) else null end,
    case when allow_offers then coalesce(wp.offers_count, 0) else null end,
    case when allow_streak then coalesce(wp.current_streak, 0) else null end,
    case when allow_certification then cert.name else null end,
    case when allow_certification then cert.progress_percentage::integer else null end,
    case
      when relation in ('self', 'friend', 'friend_preview') then shared_goals_json
      else '[]'::jsonb
    end,
    mutual_groups_json,
    mutual_goals_json,
    null::text;
end;
$$;

grant execute on function get_people_profile(uuid, text) to authenticated;
