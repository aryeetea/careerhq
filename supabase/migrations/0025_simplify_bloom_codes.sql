-- Bloom Codes are stable identifiers for starting friend requests, not
-- one-time credentials. Simplify the system to a single persistent active
-- code per user, valid until the owner manually regenerates it.

alter table friend_codes
  add column if not exists code_plaintext text;

create unique index if not exists uq_friend_codes_active_owner
  on friend_codes(created_by)
  where is_active;

drop function if exists create_friend_code(text, int);
drop function if exists regenerate_friend_code(uuid, text, int);
drop function if exists check_friend_code(text, uuid);

create or replace function create_friend_code_internal(p_owner uuid)
returns table (code text, id uuid)
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_existing friend_codes%rowtype;
  v_code text;
  v_hash bytea;
  v_hint text;
  v_id uuid;
  v_attempt int := 0;
begin
  select *
  into v_existing
  from friend_codes
  where created_by = p_owner and is_active
  order by created_at desc
  limit 1;

  if v_existing.id is not null and v_existing.code_plaintext is not null then
    return query select v_existing.code_plaintext, v_existing.id;
    return;
  end if;

  if v_existing.id is not null then
    update friend_codes
    set is_active = false, updated_at = now()
    where id = v_existing.id;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := generate_random_friend_code();
    v_hash := digest(v_code, 'sha256');
    v_hint := '••••' || right(v_code, 2);
    begin
      insert into friend_codes (created_by, code_plaintext, code_hash, code_hint)
      values (p_owner, v_code, v_hash, v_hint)
      returning friend_codes.id into v_id;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'Could not generate a unique code right now. Please try again.';
      end if;
    end;
  end loop;

  insert into friend_code_events (code_id, actor_id, event_type, success)
  values (v_id, p_owner, 'created', true);

  return query select v_code, v_id;
end;
$$;

create or replace function create_friend_code()
returns table (code text, id uuid)
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  select * from create_friend_code_internal(auth.uid());
end;
$$;

create or replace function regenerate_friend_code(p_id uuid)
returns table (code text, id uuid)
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select created_by into v_owner
  from friend_codes
  where id = p_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Friend code not found';
  end if;

  update friend_codes
  set is_active = false, updated_at = now()
  where created_by = auth.uid() and is_active;

  insert into friend_code_events (code_id, actor_id, event_type, success)
  values (p_id, auth.uid(), 'regenerated', true);

  return query
  select * from create_friend_code_internal(auth.uid());
end;
$$;

create or replace function check_friend_code(p_code text, p_viewer uuid, out v_row friend_codes, out v_error text)
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_hash bytea;
begin
  v_hash := digest(normalize_friend_code(p_code), 'sha256');

  select *
  into v_row
  from friend_codes
  where code_hash = v_hash
  order by created_at desc
  limit 1;

  if v_row.id is null then
    v_error := 'We couldn''t find that Bloom Code. Check the characters and try again.';
  elsif not v_row.is_active then
    v_error := 'This Bloom Code is no longer active.';
  elsif v_row.created_by = p_viewer then
    v_error := 'That''s your own Bloom Code.';
  elsif is_friend(v_row.created_by, p_viewer) then
    v_error := 'You''re already connected on Bloom.';
  elsif is_blocked(v_row.created_by, p_viewer) then
    v_error := 'This connection cannot be completed.';
  end if;
end;
$$;

create or replace function validate_friend_code(p_code text)
returns table (
  success boolean,
  error_message text,
  owner_id uuid,
  display_name text,
  username text,
  avatar_url text,
  bio text,
  career_goal text,
  mutual_groups text[]
)
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_viewer uuid := auth.uid();
  v_check record;
  v_row friend_codes%rowtype;
  v_error text;
begin
  if v_viewer is null then
    raise exception 'Authentication required';
  end if;

  if (
    select count(*)
    from friend_code_events
    where actor_id = v_viewer
      and event_type = 'validate_attempt'
      and created_at > now() - interval '10 minutes'
  ) >= 5 then
    v_error := 'Too many attempts. Take a short break and try again.';
  else
    select * into v_check from check_friend_code(p_code, v_viewer);
    v_row := v_check.v_row;
    v_error := v_check.v_error;
  end if;

  insert into friend_code_events (code_id, actor_id, event_type, success)
  values (v_row.id, v_viewer, 'validate_attempt', v_error is null);

  if v_error is not null then
    return query
    select false, v_error, null::uuid, null::text, null::text, null::text, null::text, null::text, null::text[];
    return;
  end if;

  return query
  select
    true,
    null::text,
    p.id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.bio,
    p.career_goal,
    coalesce((
      select array_agg(g.name)
      from groups g
      join group_members gm1 on gm1.group_id = g.id and gm1.user_id = v_row.created_by
      join group_members gm2 on gm2.group_id = g.id and gm2.user_id = v_viewer
    ), '{}'::text[])
  from profiles p
  where p.id = v_row.created_by;
end;
$$;

create or replace function use_friend_code(p_code text)
returns table (success boolean, error_message text, request_id uuid)
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_viewer uuid := auth.uid();
  v_check record;
  v_row friend_codes%rowtype;
  v_error text;
  v_request_id uuid;
begin
  if v_viewer is null then
    raise exception 'Authentication required';
  end if;

  select * into v_check from check_friend_code(p_code, v_viewer);
  v_row := v_check.v_row;
  v_error := v_check.v_error;

  if v_error is not null then
    return query select false, v_error, null::uuid;
    return;
  end if;

  insert into friend_requests (requester_id, recipient_id)
  values (v_viewer, v_row.created_by)
  on conflict do nothing
  returning id into v_request_id;

  if v_request_id is null then
    select id into v_request_id
    from friend_requests
    where requester_id = v_viewer
      and recipient_id = v_row.created_by
      and status = 'pending';
  end if;

  insert into friend_code_events (code_id, actor_id, event_type, success)
  values (v_row.id, v_viewer, 'used', true);

  return query select true, null::text, v_request_id;
end;
$$;

revoke all on function check_friend_code(text, uuid) from public, anon, authenticated;
revoke all on function create_friend_code_internal(uuid) from public, anon, authenticated;

revoke execute on function create_friend_code() from public, anon;
grant execute on function create_friend_code() to authenticated;

revoke execute on function regenerate_friend_code(uuid) from public, anon;
grant execute on function regenerate_friend_code(uuid) to authenticated;
