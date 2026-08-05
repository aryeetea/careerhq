-- Proper fix (0017 was insufficient): Postgres cannot partially commit a
-- transaction — if the top-level RPC call itself ultimately raises, EVERY
-- write inside it rolls back, including writes made from an EXCEPTION
-- handler, because that handler's writes are not an independent
-- transaction, just a savepoint within the same doomed one. The only way
-- an audit-log row survives a "this attempt failed" outcome without a
-- heavyweight autonomous-transaction mechanism (dblink et al, not worth it
-- here) is for the RPC to not raise for anticipated validation failures at
-- all — return a typed {success, error_message} result instead, so the
-- overall call succeeds and commits normally. The client throws a JS Error
-- from error_message, so nothing about the UI/error-handling contract
-- changes. Verified live: failed-attempt rows now persist and the rate
-- limiter correctly fires on the 6th attempt within the window.

drop function if exists validate_friend_code_row(text, uuid);
drop function if exists validate_friend_code(text);
drop function if exists use_friend_code(text);
drop function if exists check_friend_code(text, uuid);

-- Pure, non-raising check — no writes, so no transactional concerns.
create or replace function check_friend_code(p_code text, p_viewer uuid, out v_row friend_codes, out v_error text)
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_hash bytea;
begin
  v_hash := digest(normalize_friend_code(p_code), 'sha256');
  select * into v_row from friend_codes where code_hash = v_hash order by created_at desc limit 1;

  if v_row.id is null then
    v_error := 'We couldn''t find that friend code. Check the characters and try again.';
  elsif not v_row.is_active then
    v_error := 'This code is no longer active.';
  elsif v_row.expires_at is not null and v_row.expires_at < now() then
    v_error := 'This code has expired. Ask your friend to generate a new one.';
  elsif v_row.use_count >= v_row.max_uses then
    v_error := 'This one-time code has already been used.';
  elsif v_row.created_by = p_viewer then
    v_error := 'That''s your own friend code.';
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

  if (select count(*) from friend_code_events where actor_id = v_viewer and event_type = 'validate_attempt' and created_at > now() - interval '10 minutes') >= 5 then
    v_error := 'Too many attempts. Take a short break and try again.';
  else
    select * into v_check from check_friend_code(p_code, v_viewer);
    v_row := v_check.v_row;
    v_error := v_check.v_error;
  end if;

  insert into friend_code_events (code_id, actor_id, event_type, success)
  values (v_row.id, v_viewer, 'validate_attempt', v_error is null);

  if v_error is not null then
    return query select false, v_error, null::uuid, null::text, null::text, null::text, null::text, null::text, null::text[];
    return;
  end if;

  return query
  select
    true, null::text,
    p.id, p.display_name, p.username, p.avatar_url, p.bio, p.career_goal,
    coalesce((
      select array_agg(g.name) from groups g
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
    select id into v_request_id from friend_requests
    where requester_id = v_viewer and recipient_id = v_row.created_by and status = 'pending';
  end if;

  update friend_codes set use_count = use_count + 1, updated_at = now() where id = v_row.id;
  insert into friend_code_events (code_id, actor_id, event_type, success) values (v_row.id, v_viewer, 'used', true);

  return query select true, null::text, v_request_id;
end;
$$;

revoke all on function check_friend_code(text, uuid) from public, anon, authenticated;
revoke execute on function validate_friend_code(text) from public, anon;
grant execute on function validate_friend_code(text) to authenticated;
revoke execute on function use_friend_code(text) from public, anon;
grant execute on function use_friend_code(text) to authenticated;
