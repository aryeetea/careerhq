-- Bloom — get_friend_card has always raised 42702 "column reference
-- user_id is ambiguous" on every single call, in production, since
-- 0021_profile_career_status_and_skills.sql redefined it.
--
-- Same bug class fixed once before for get_people_profile (0029/0031):
-- `returns table (user_id uuid, ...)` implicitly declares a PL/pgSQL
-- variable named user_id for that OUT column, so the unqualified
-- `where user_id = p_user_id` inside the function body could mean either
-- privacy_settings.user_id or that OUT variable — Postgres refuses to
-- guess. Found while building the Community Friends tab: every friend
-- card silently failed to load (get_friend_card 400, swallowed by
-- Promise.all in getFriendCards), so the Friends tab rendered no cards at
-- all for accounts with real friends. Confirmed via direct SQL
-- reproduction with SET ROLE authenticated + request.jwt.claims, mirroring
-- the technique used for the earlier RLS-race bugs this session.
--
-- Fixing that unmasked a second, previously-unreachable bug: this function
-- never ran the RETURN QUERY far enough to hit it before. certifications.
-- progress_percentage is smallint; certification_percentage here is
-- declared integer. Same mismatch, same fix, as get_people_profile's
-- 0031 migration — cast it.
--
-- Fix: qualify the one ambiguous reference, and cast the smallint.
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

  select * into ps from privacy_settings where privacy_settings.user_id = p_user_id;
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
      then cert.progress_percentage::integer else null end;
end;
$$;

grant execute on function get_friend_card(uuid) to authenticated;
