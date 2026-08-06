-- =====================================================================
-- Bloom — Social schema: friends, privacy, shared goals, groups,
-- encouragement reactions, activity/notifications feed, weekly progress.
--
-- Run AFTER 0001_core_schema.sql.
--
-- Design principle: friends and group members NEVER get direct table
-- access to another user's jobs/resumes/certifications. All shared data
-- flows through `weekly_progress` (aggregate counts only, no company/
-- title/recruiter/notes) and through SECURITY DEFINER functions that
-- enforce friendship + per-field privacy_settings before returning
-- anything. Direct RLS on weekly_progress stays owner-only.
-- =====================================================================

do $$ begin
  create type friend_request_status as enum ('pending', 'accepted', 'declined', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reaction_type as enum ('proud', 'keep_going', 'you_got_this', 'congrats', 'cheering');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reaction_context as enum ('weekly_progress', 'goal', 'group', 'general');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- privacy_settings — per-field visibility, private by default
-- ---------------------------------------------------------------------
create table if not exists privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_visibility visibility_level not null default 'private',
  weekly_count_visibility visibility_level not null default 'private',
  monthly_count_visibility visibility_level not null default 'private',
  interview_count_visibility visibility_level not null default 'private',
  offer_count_visibility visibility_level not null default 'private',
  goal_progress_visibility visibility_level not null default 'private',
  certification_visibility visibility_level not null default 'private',
  streak_visibility visibility_level not null default 'private',
  status_message_visibility visibility_level not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_privacy_settings_updated_at on privacy_settings;
create trigger trg_privacy_settings_updated_at before update on privacy_settings
  for each row execute function set_updated_at();

alter table privacy_settings enable row level security;

drop policy if exists "privacy_settings_owner_all" on privacy_settings;
create policy "privacy_settings_owner_all" on privacy_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The curated allow-list used when a privacy field is set to 'selected_friends'.
create table if not exists privacy_selected_friends (
  owner_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id)
);

alter table privacy_selected_friends enable row level security;

drop policy if exists "privacy_selected_owner_all" on privacy_selected_friends;
create policy "privacy_selected_owner_all" on privacy_selected_friends for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------
-- friend_requests
-- ---------------------------------------------------------------------
create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status friend_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_self_request check (requester_id <> recipient_id)
);

create unique index if not exists uq_friend_requests_pending
  on friend_requests(requester_id, recipient_id) where (status = 'pending');

create index if not exists idx_friend_requests_recipient on friend_requests(recipient_id, status);
create index if not exists idx_friend_requests_requester on friend_requests(requester_id, status);

drop trigger if exists trg_friend_requests_updated_at on friend_requests;
create trigger trg_friend_requests_updated_at before update on friend_requests
  for each row execute function set_updated_at();

alter table friend_requests enable row level security;

drop policy if exists "friend_requests_select" on friend_requests;
create policy "friend_requests_select" on friend_requests for select
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists "friend_requests_insert" on friend_requests;
create policy "friend_requests_insert" on friend_requests for insert
  with check (auth.uid() = requester_id);

drop policy if exists "friend_requests_update" on friend_requests;
create policy "friend_requests_update" on friend_requests for update
  using (auth.uid() = requester_id or auth.uid() = recipient_id)
  with check (auth.uid() = requester_id or auth.uid() = recipient_id);

-- ---------------------------------------------------------------------
-- friendships — normalized undirected pair (user_id_a < user_id_b)
-- ---------------------------------------------------------------------
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  user_id_a uuid not null references auth.users(id) on delete cascade,
  user_id_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint ordered_pair check (user_id_a < user_id_b),
  unique (user_id_a, user_id_b)
);

create index if not exists idx_friendships_a on friendships(user_id_a);
create index if not exists idx_friendships_b on friendships(user_id_b);

alter table friendships enable row level security;

drop policy if exists "friendships_select" on friendships;
create policy "friendships_select" on friendships for select
  using (auth.uid() = user_id_a or auth.uid() = user_id_b);

drop policy if exists "friendships_delete" on friendships;
create policy "friendships_delete" on friendships for delete
  using (auth.uid() = user_id_a or auth.uid() = user_id_b);

-- Friendships are only ever created by accept_friend_request() below,
-- never directly by clients, so there is intentionally no insert policy.

-- Accepting a request creates the normalized friendship row and marks
-- the request accepted, atomically, as the recipient only.
create or replace function accept_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  req friend_requests%rowtype;
  lo uuid;
  hi uuid;
begin
  select * into req from friend_requests where id = p_request_id for update;
  if req.id is null then
    raise exception 'Friend request not found';
  end if;
  if req.recipient_id <> auth.uid() then
    raise exception 'Only the recipient can accept a friend request';
  end if;
  if req.status <> 'pending' then
    raise exception 'Friend request is no longer pending';
  end if;

  lo := least(req.requester_id, req.recipient_id);
  hi := greatest(req.requester_id, req.recipient_id);

  insert into friendships (user_id_a, user_id_b) values (lo, hi)
  on conflict (user_id_a, user_id_b) do nothing;

  update friend_requests set status = 'accepted' where id = p_request_id;

  insert into activity_events (recipient_id, actor_id, type, entity_type, entity_id)
  values (req.requester_id, req.recipient_id, 'friend_request_accepted', 'friendship', p_request_id);
end;
$$;

-- ---------------------------------------------------------------------
-- user_blocks
-- ---------------------------------------------------------------------
create table if not exists user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

alter table user_blocks enable row level security;

drop policy if exists "user_blocks_select" on user_blocks;
create policy "user_blocks_select" on user_blocks for select
  using (auth.uid() = blocker_id);

drop policy if exists "user_blocks_insert" on user_blocks;
create policy "user_blocks_insert" on user_blocks for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "user_blocks_delete" on user_blocks;
create policy "user_blocks_delete" on user_blocks for delete
  using (auth.uid() = blocker_id);

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
create or replace function is_friend(a uuid, b uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from friendships
    where user_id_a = least(a, b) and user_id_b = greatest(a, b)
  );
$$;

create or replace function is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- Resolve whether `owner` allows `viewer` to see a field set to `level`.
create or replace function visibility_allows(owner uuid, viewer uuid, level visibility_level)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if owner = viewer then return true; end if;
  if is_blocked(owner, viewer) then return false; end if;
  case level
    when 'hidden' then return false;
    when 'private' then return false;
    when 'friends_only' then return is_friend(owner, viewer);
    when 'selected_friends' then
      return is_friend(owner, viewer) and exists (
        select 1 from privacy_selected_friends where owner_id = owner and friend_id = viewer
      );
    else return false;
  end case;
end;
$$;

-- ---------------------------------------------------------------------
-- weekly_progress — the ONLY shareable job-search aggregate.
-- Row-level security keeps this owner-only; friends read it exclusively
-- through get_friend_card() below, which enforces privacy_settings.
-- ---------------------------------------------------------------------
create table if not exists weekly_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  applications_count integer not null default 0,
  interviews_count integer not null default 0,
  offers_count integer not null default 0,
  rejections_count integer not null default 0,
  weekly_goal integer not null default 0,
  current_streak integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table weekly_progress enable row level security;

drop policy if exists "weekly_progress_owner_select" on weekly_progress;
create policy "weekly_progress_owner_select" on weekly_progress for select
  using (auth.uid() = user_id);

-- Streak = consecutive days up to today with at least one job application.
create or replace function compute_streak(p_user_id uuid)
returns integer
language plpgsql
stable
security definer set search_path = public
as $$
declare
  d date := current_date;
  streak int := 0;
begin
  loop
    exit when not exists (
      select 1 from jobs
      where user_id = p_user_id and date_applied is not null and date_applied::date = d
    );
    streak := streak + 1;
    d := d - 1;
  end loop;
  return streak;
end;
$$;

create or replace function sync_weekly_progress(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  wk date := date_trunc('week', current_date)::date;
  wk_end date := wk + 6;
  goal int;
begin
  select weekly_application_goal into goal from profiles where id = p_user_id;

  insert into weekly_progress (
    user_id, week_start, applications_count, interviews_count,
    offers_count, rejections_count, weekly_goal, current_streak, updated_at
  )
  values (
    p_user_id, wk,
    (select count(*) from jobs where user_id = p_user_id and date_applied::date between wk and wk_end),
    (select count(*) from jobs where user_id = p_user_id and status in ('interview', 'final_interview') and updated_at::date between wk and wk_end),
    (select count(*) from jobs where user_id = p_user_id and status = 'offer' and updated_at::date between wk and wk_end),
    (select count(*) from jobs where user_id = p_user_id and status = 'rejected' and updated_at::date between wk and wk_end),
    coalesce(goal, 0),
    compute_streak(p_user_id),
    now()
  )
  on conflict (user_id, week_start) do update set
    applications_count = excluded.applications_count,
    interviews_count = excluded.interviews_count,
    offers_count = excluded.offers_count,
    rejections_count = excluded.rejections_count,
    weekly_goal = excluded.weekly_goal,
    current_streak = excluded.current_streak,
    updated_at = now();
end;
$$;

create or replace function jobs_sync_weekly_progress()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform sync_weekly_progress(old.user_id);
    return old;
  end if;
  perform sync_weekly_progress(new.user_id);
  return new;
end;
$$;

drop trigger if exists trg_jobs_sync_weekly_progress on jobs;
create trigger trg_jobs_sync_weekly_progress after insert or update or delete on jobs
  for each row execute function jobs_sync_weekly_progress();

-- ---------------------------------------------------------------------
-- goals + goal_members (personal or shared)
-- ---------------------------------------------------------------------
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  target_count integer not null default 1 check (target_count > 0),
  unit text not null default 'applications',
  deadline date,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_goals_updated_at on goals;
create trigger trg_goals_updated_at before update on goals
  for each row execute function set_updated_at();

create table if not exists goal_members (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  progress_count integer not null default 0 check (progress_count >= 0),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (goal_id, user_id)
);

drop trigger if exists trg_goal_members_updated_at on goal_members;
create trigger trg_goal_members_updated_at before update on goal_members
  for each row execute function set_updated_at();

create or replace function is_goal_member(g uuid, u uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from goal_members where goal_id = g and user_id = u);
$$;

-- Owner is automatically a member of their own goal.
create or replace function goals_add_owner_member()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into goal_members (goal_id, user_id) values (new.id, new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_goals_add_owner on goals;
create trigger trg_goals_add_owner after insert on goals
  for each row execute function goals_add_owner_member();

alter table goals enable row level security;

drop policy if exists "goals_select" on goals;
create policy "goals_select" on goals for select
  using (is_goal_member(id, auth.uid()) or (is_shared and is_friend(owner_id, auth.uid())));

drop policy if exists "goals_insert" on goals;
create policy "goals_insert" on goals for insert
  with check (auth.uid() = owner_id);

drop policy if exists "goals_update" on goals;
create policy "goals_update" on goals for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "goals_delete" on goals;
create policy "goals_delete" on goals for delete
  using (auth.uid() = owner_id);

alter table goal_members enable row level security;

drop policy if exists "goal_members_select" on goal_members;
create policy "goal_members_select" on goal_members for select
  using (
    is_goal_member(goal_id, auth.uid())
    or exists (select 1 from goals g where g.id = goal_id and g.owner_id = auth.uid())
  );

drop policy if exists "goal_members_join" on goal_members;
create policy "goal_members_join" on goal_members for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from goals g where g.id = goal_id and g.is_shared and is_friend(g.owner_id, auth.uid()))
  );

drop policy if exists "goal_members_update_own" on goal_members;
create policy "goal_members_update_own" on goal_members for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goal_members_leave" on goal_members;
create policy "goal_members_leave" on goal_members for delete
  using (auth.uid() = user_id or exists (select 1 from goals g where g.id = goal_id and g.owner_id = auth.uid()));

-- ---------------------------------------------------------------------
-- groups + group_members + group_invites
-- ---------------------------------------------------------------------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  weekly_goal_target integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_groups_updated_at on groups;
create trigger trg_groups_updated_at before update on groups
  for each row execute function set_updated_at();

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create or replace function is_group_member(g uuid, u uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from group_members where group_id = g and user_id = u);
$$;

create or replace function groups_add_owner_member()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into group_members (group_id, user_id, role) values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_groups_add_owner on groups;
create trigger trg_groups_add_owner after insert on groups
  for each row execute function groups_add_owner_member();

alter table groups enable row level security;

drop policy if exists "groups_select" on groups;
create policy "groups_select" on groups for select
  using (is_group_member(id, auth.uid()));

drop policy if exists "groups_insert" on groups;
create policy "groups_insert" on groups for insert
  with check (auth.uid() = owner_id);

drop policy if exists "groups_update" on groups;
create policy "groups_update" on groups for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "groups_delete" on groups;
create policy "groups_delete" on groups for delete
  using (auth.uid() = owner_id);

alter table group_members enable row level security;

drop policy if exists "group_members_select" on group_members;
create policy "group_members_select" on group_members for select
  using (is_group_member(group_id, auth.uid()));

drop policy if exists "group_members_leave" on group_members;
create policy "group_members_leave" on group_members for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create table if not exists group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status friend_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, invitee_id)
);

drop trigger if exists trg_group_invites_updated_at on group_invites;
create trigger trg_group_invites_updated_at before update on group_invites
  for each row execute function set_updated_at();

alter table group_invites enable row level security;

drop policy if exists "group_invites_select" on group_invites;
create policy "group_invites_select" on group_invites for select
  using (auth.uid() = invitee_id or auth.uid() = inviter_id or is_group_member(group_id, auth.uid()));

drop policy if exists "group_invites_insert" on group_invites;
create policy "group_invites_insert" on group_invites for insert
  with check (auth.uid() = inviter_id and is_group_member(group_id, auth.uid()) and is_friend(inviter_id, invitee_id));

drop policy if exists "group_invites_update" on group_invites;
create policy "group_invites_update" on group_invites for update
  using (auth.uid() = invitee_id or auth.uid() = inviter_id)
  with check (auth.uid() = invitee_id or auth.uid() = inviter_id);

create or replace function accept_group_invite(p_invite_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  inv group_invites%rowtype;
begin
  select * into inv from group_invites where id = p_invite_id for update;
  if inv.id is null then raise exception 'Invite not found'; end if;
  if inv.invitee_id <> auth.uid() then raise exception 'Only the invitee can accept'; end if;
  if inv.status <> 'pending' then raise exception 'Invite is no longer pending'; end if;

  insert into group_members (group_id, user_id, role) values (inv.group_id, inv.invitee_id, 'member')
  on conflict do nothing;

  update group_invites set status = 'accepted' where id = p_invite_id;
end;
$$;

-- ---------------------------------------------------------------------
-- encouragement_reactions
-- ---------------------------------------------------------------------
create table if not exists encouragement_reactions (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  context_type reaction_context not null default 'general',
  context_id uuid,
  reaction_type reaction_type not null,
  created_at timestamptz not null default now(),
  constraint no_self_reaction check (sender_id <> recipient_id)
);

create index if not exists idx_reactions_recipient on encouragement_reactions(recipient_id, created_at desc);
create index if not exists idx_reactions_context on encouragement_reactions(context_type, context_id);

alter table encouragement_reactions enable row level security;

drop policy if exists "reactions_select" on encouragement_reactions;
create policy "reactions_select" on encouragement_reactions for select
  using (
    auth.uid() = sender_id
    or auth.uid() = recipient_id
    or (context_type = 'goal' and is_goal_member(context_id, auth.uid()))
    or (context_type = 'group' and is_group_member(context_id, auth.uid()))
  );

drop policy if exists "reactions_insert" on encouragement_reactions;
create policy "reactions_insert" on encouragement_reactions for insert
  with check (
    auth.uid() = sender_id
    and not is_blocked(sender_id, recipient_id)
    and (
      is_friend(sender_id, recipient_id)
      or (context_type = 'goal' and is_goal_member(context_id, sender_id) and is_goal_member(context_id, recipient_id))
      or (context_type = 'group' and is_group_member(context_id, sender_id) and is_group_member(context_id, recipient_id))
    )
  );

drop policy if exists "reactions_delete" on encouragement_reactions;
create policy "reactions_delete" on encouragement_reactions for delete
  using (auth.uid() = sender_id);

-- ---------------------------------------------------------------------
-- activity_events — powers the in-app notification bell
-- ---------------------------------------------------------------------
create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_recipient on activity_events(recipient_id, created_at desc);

alter table activity_events enable row level security;

drop policy if exists "activity_select" on activity_events;
create policy "activity_select" on activity_events for select
  using (auth.uid() = recipient_id);

drop policy if exists "activity_update_own" on activity_events;
create policy "activity_update_own" on activity_events for update
  using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

drop policy if exists "activity_insert_self" on activity_events;
create policy "activity_insert_self" on activity_events for insert
  with check (auth.uid() = recipient_id);

-- Notify on new friend request
create or replace function notify_friend_request()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into activity_events (recipient_id, actor_id, type, entity_type, entity_id)
  values (new.recipient_id, new.requester_id, 'friend_request_received', 'friend_request', new.id);
  return new;
end;
$$;

drop trigger if exists trg_notify_friend_request on friend_requests;
create trigger trg_notify_friend_request after insert on friend_requests
  for each row execute function notify_friend_request();

-- Notify on encouragement reaction
create or replace function notify_reaction()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into activity_events (recipient_id, actor_id, type, entity_type, entity_id, payload)
  values (new.recipient_id, new.sender_id, 'reaction_received', 'reaction', new.id, jsonb_build_object('reaction_type', new.reaction_type, 'context_type', new.context_type));
  return new;
end;
$$;

drop trigger if exists trg_notify_reaction on encouragement_reactions;
create trigger trg_notify_reaction after insert on encouragement_reactions
  for each row execute function notify_reaction();

-- Notify on group invite
create or replace function notify_group_invite()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into activity_events (recipient_id, actor_id, type, entity_type, entity_id)
  values (new.invitee_id, new.inviter_id, 'group_invite_received', 'group_invite', new.id);
  return new;
end;
$$;

drop trigger if exists trg_notify_group_invite on group_invites;
create trigger trg_notify_group_invite after insert on group_invites
  for each row execute function notify_group_invite();

-- ---------------------------------------------------------------------
-- Public-safe RPCs: username search + friend progress card
-- ---------------------------------------------------------------------

-- Search users by username, excluding self and blocked users. Returns
-- only the minimal fields needed to send a friend request.
create or replace function search_users_by_username(p_query text)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from profiles p
  where p.username ilike '%' || p_query || '%'
    and p.id <> auth.uid()
    and not is_blocked(auth.uid(), p.id)
  order by p.username
  limit 20;
$$;

-- The single privacy-aware entry point friends use to render a
-- "friend card". Every field is nulled out unless the owner's
-- privacy_settings explicitly allow the caller to see it.
create or replace function get_friend_card(p_user_id uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  status_message text,
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

grant execute on function search_users_by_username(text) to authenticated;
grant execute on function get_friend_card(uuid) to authenticated;
grant execute on function accept_friend_request(uuid) to authenticated;
grant execute on function accept_group_invite(uuid) to authenticated;
grant execute on function sync_weekly_progress(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Now that profiles, settings, and privacy_settings all exist, wire up
-- the auth.users -> profiles bootstrap trigger (function defined in
-- 0001_core_schema.sql).
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
