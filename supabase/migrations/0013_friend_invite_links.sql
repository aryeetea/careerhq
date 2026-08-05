-- =====================================================================
-- Bloom — Friend invite-by-link. Mirrors group_join_links /
-- preview_group_join_link / join_group_via_link exactly, plus a use cap
-- (max_uses/use_count) the group version doesn't need. Also adds two small
-- read-only RPCs (mutual connections, friend suggestions) to back the
-- Friends page redesign.
-- =====================================================================

create table if not exists friend_invite_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  is_active boolean not null default true,
  expires_at timestamptz,
  max_uses integer,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_friend_invite_links_owner on friend_invite_links(owner_id);
create index if not exists idx_friend_invite_links_token on friend_invite_links(token);

drop trigger if exists trg_friend_invite_links_updated_at on friend_invite_links;
create trigger trg_friend_invite_links_updated_at before update on friend_invite_links
  for each row execute function set_updated_at();

alter table friend_invite_links enable row level security;

drop policy if exists "friend_invite_links_select" on friend_invite_links;
create policy "friend_invite_links_select" on friend_invite_links for select
  using (auth.uid() = owner_id);

drop policy if exists "friend_invite_links_insert" on friend_invite_links;
create policy "friend_invite_links_insert" on friend_invite_links for insert
  with check (auth.uid() = owner_id);

drop policy if exists "friend_invite_links_update" on friend_invite_links;
create policy "friend_invite_links_update" on friend_invite_links for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Public-safe preview: only fields the owner already writes for display
-- purposes (never weekly counts, streaks, or job data).
create or replace function preview_friend_invite_link(p_token text)
returns table (
  owner_id uuid,
  display_name text,
  username text,
  avatar_url text,
  bio text,
  career_goal text,
  is_active boolean,
  expires_at timestamptz,
  max_uses integer,
  use_count integer
)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  select
    fil.owner_id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.bio,
    p.career_goal,
    fil.is_active,
    fil.expires_at,
    fil.max_uses,
    fil.use_count
  from friend_invite_links fil
  join profiles p on p.id = fil.owner_id
  where fil.token = p_token;
end;
$$;

create or replace function accept_friend_invite_link(p_token text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_link friend_invite_links%rowtype;
  lo uuid;
  hi uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_link from friend_invite_links where token = p_token for update;

  if v_link.id is null then
    raise exception 'Invite link not found';
  end if;
  if v_link.owner_id = auth.uid() then
    raise exception 'You can''t accept your own invite link';
  end if;
  if not v_link.is_active then
    raise exception 'This invite link is no longer active';
  end if;
  if v_link.expires_at is not null and v_link.expires_at < now() then
    raise exception 'This invite link has expired';
  end if;
  if v_link.max_uses is not null and v_link.use_count >= v_link.max_uses then
    raise exception 'This invite link has reached its limit';
  end if;
  if is_blocked(v_link.owner_id, auth.uid()) then
    raise exception 'Unable to accept this invite';
  end if;

  lo := least(v_link.owner_id, auth.uid());
  hi := greatest(v_link.owner_id, auth.uid());

  insert into friendships (user_id_a, user_id_b) values (lo, hi)
  on conflict do nothing;

  update friend_invite_links
  set use_count = use_count + 1, last_used_at = now()
  where id = v_link.id;

  insert into activity_events (recipient_id, actor_id, type, entity_type, entity_id)
  values (v_link.owner_id, auth.uid(), 'friend_invite_accepted', 'friend_invite_link', v_link.id);

  return v_link.owner_id;
end;
$$;

-- Shared groups / shared goals with a friend — gated by is_friend() like
-- get_friend_card, powers "Mutual Groups" / "Mutual Goals".
create or replace function get_mutual_connections(p_user_id uuid)
returns table (mutual_groups text[], mutual_goals text[])
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not is_friend(p_user_id, auth.uid()) then
    raise exception 'Not friends with this user';
  end if;

  return query
  select
    coalesce((
      select array_agg(g.name) from groups g
      join group_members gm1 on gm1.group_id = g.id and gm1.user_id = p_user_id
      join group_members gm2 on gm2.group_id = g.id and gm2.user_id = auth.uid()
    ), '{}'::text[]),
    coalesce((
      select array_agg(gl.name) from goals gl
      join goal_members gm1 on gm1.goal_id = gl.id and gm1.user_id = p_user_id
      join goal_members gm2 on gm2.goal_id = gl.id and gm2.user_id = auth.uid()
      where gl.is_shared
    ), '{}'::text[]);
end;
$$;

-- People who share a group with the caller, excluding existing friends,
-- blocked users, self, and anyone with a pending request already.
create or replace function suggest_friends(p_limit integer default 6)
returns table (id uuid, username text, display_name text, avatar_url text, mutual_group_count bigint)
language sql
stable
security definer set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, count(distinct gm2.group_id) as mutual_group_count
  from group_members gm1
  join group_members gm2 on gm2.group_id = gm1.group_id and gm2.user_id <> gm1.user_id
  join profiles p on p.id = gm2.user_id
  where gm1.user_id = auth.uid()
    and not is_friend(auth.uid(), gm2.user_id)
    and not is_blocked(auth.uid(), gm2.user_id)
    and not exists (
      select 1 from friend_requests fr
      where fr.status = 'pending'
        and ((fr.requester_id = auth.uid() and fr.recipient_id = gm2.user_id)
          or (fr.requester_id = gm2.user_id and fr.recipient_id = auth.uid()))
    )
  group by p.id, p.username, p.display_name, p.avatar_url
  order by mutual_group_count desc
  limit p_limit;
$$;

revoke all on table friend_invite_links from public, anon;
grant select, insert, update on table friend_invite_links to authenticated;

revoke execute on function preview_friend_invite_link(text) from public;
grant execute on function preview_friend_invite_link(text) to anon, authenticated;

revoke execute on function accept_friend_invite_link(text) from public, anon;
grant execute on function accept_friend_invite_link(text) to authenticated;

revoke execute on function get_mutual_connections(uuid) from public, anon;
grant execute on function get_mutual_connections(uuid) to authenticated;

revoke execute on function suggest_friends(integer) from public, anon;
grant execute on function suggest_friends(integer) to authenticated;
