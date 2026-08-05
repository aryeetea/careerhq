-- Bug found by direct testing: an INSERT immediately followed by RAISE
-- EXCEPTION in the same PL/pgSQL block gets rolled back along with
-- everything else in that block — so every "failed attempt" audit/rate-limit
-- log row was silently disappearing. Fix: validate_friend_code_row now only
-- validates and raises (no logging); the wrapping functions log failures
-- from inside an EXCEPTION WHEN handler, which is a genuine sub-transaction
-- boundary in Postgres — writes made there survive even though the error
-- that triggered them propagates on.

drop function if exists validate_friend_code_row(text, uuid, boolean);

create or replace function validate_friend_code_row(p_code text, p_viewer uuid)
returns friend_codes
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_hash bytea;
  v_link friend_codes%rowtype;
begin
  perform check_friend_code_rate_limit(p_viewer);

  v_hash := digest(normalize_friend_code(p_code), 'sha256');
  select * into v_link from friend_codes where code_hash = v_hash order by created_at desc limit 1;

  if v_link.id is null then
    raise exception 'We couldn''t find that friend code. Check the characters and try again.';
  end if;

  if not v_link.is_active then
    raise exception 'This code is no longer active.';
  end if;

  if v_link.expires_at is not null and v_link.expires_at < now() then
    raise exception 'This code has expired. Ask your friend to generate a new one.';
  end if;

  if v_link.use_count >= v_link.max_uses then
    raise exception 'This one-time code has already been used.';
  end if;

  if v_link.created_by = p_viewer then
    raise exception 'That''s your own friend code.';
  end if;

  if is_friend(v_link.created_by, p_viewer) then
    raise exception 'You''re already connected on Bloom.';
  end if;

  if is_blocked(v_link.created_by, p_viewer) then
    raise exception 'This connection cannot be completed.';
  end if;

  return v_link;
end;
$$;

create or replace function validate_friend_code(p_code text)
returns table (
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
  v_link friend_codes%rowtype;
begin
  if v_viewer is null then
    raise exception 'Authentication required';
  end if;

  begin
    v_link := validate_friend_code_row(p_code, v_viewer);
  exception when others then
    insert into friend_code_events (code_id, actor_id, event_type, success) values (null, v_viewer, 'validate_attempt', false);
    raise;
  end;

  insert into friend_code_events (code_id, actor_id, event_type, success) values (v_link.id, v_viewer, 'validate_attempt', true);

  return query
  select
    p.id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.bio,
    p.career_goal,
    coalesce((
      select array_agg(g.name) from groups g
      join group_members gm1 on gm1.group_id = g.id and gm1.user_id = v_link.created_by
      join group_members gm2 on gm2.group_id = g.id and gm2.user_id = v_viewer
    ), '{}'::text[])
  from profiles p
  where p.id = v_link.created_by;
end;
$$;

create or replace function use_friend_code(p_code text)
returns uuid
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_viewer uuid := auth.uid();
  v_link friend_codes%rowtype;
  v_request_id uuid;
begin
  if v_viewer is null then
    raise exception 'Authentication required';
  end if;

  -- Re-validate (state can drift between preview and this click). Not
  -- separately logged as a validate_attempt — the preview step already did.
  v_link := validate_friend_code_row(p_code, v_viewer);

  insert into friend_requests (requester_id, recipient_id)
  values (v_viewer, v_link.created_by)
  on conflict do nothing
  returning id into v_request_id;

  if v_request_id is null then
    select id into v_request_id from friend_requests
    where requester_id = v_viewer and recipient_id = v_link.created_by and status = 'pending';
  end if;

  update friend_codes set use_count = use_count + 1, updated_at = now() where id = v_link.id;
  insert into friend_code_events (code_id, actor_id, event_type, success) values (v_link.id, v_viewer, 'used', true);

  return v_request_id;
end;
$$;

revoke all on function validate_friend_code_row(text, uuid) from public, anon, authenticated;
