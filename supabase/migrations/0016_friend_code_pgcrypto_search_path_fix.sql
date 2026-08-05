-- pgcrypto (digest()) lives in the `extensions` schema in this project, not
-- `public` — the two functions calling digest() need it on their search_path.
create or replace function create_friend_code_internal(p_owner uuid, p_expires_in text, p_max_uses int)
returns table (code text, id uuid, expires_at timestamptz, max_uses int)
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_code text;
  v_hash bytea;
  v_hint text;
  v_expires_at timestamptz;
  v_id uuid;
  v_attempt int := 0;
begin
  if p_max_uses not in (1, 5, 10) then
    raise exception 'Invalid max uses';
  end if;

  v_expires_at := case p_expires_in
    when '24h' then now() + interval '24 hours'
    when '7d' then now() + interval '7 days'
    when '30d' then now() + interval '30 days'
    when 'never' then null
    else now() + interval '7 days'
  end;

  loop
    v_attempt := v_attempt + 1;
    v_code := generate_random_friend_code();
    v_hash := digest(v_code, 'sha256');
    v_hint := '••••' || right(v_code, 2);
    begin
      insert into friend_codes (created_by, code_hash, code_hint, expires_at, max_uses)
      values (p_owner, v_hash, v_hint, v_expires_at, p_max_uses)
      returning friend_codes.id into v_id;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'Could not generate a unique code right now — please try again.';
      end if;
    end;
  end loop;

  insert into friend_code_events (code_id, actor_id, event_type, success)
  values (v_id, p_owner, 'created', true);

  return query select v_code, v_id, v_expires_at, p_max_uses;
end;
$$;

create or replace function validate_friend_code_row(p_code text, p_viewer uuid, p_log_attempts boolean)
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
    if p_log_attempts then insert into friend_code_events (code_id, actor_id, event_type, success) values (null, p_viewer, 'validate_attempt', false); end if;
    raise exception 'We couldn''t find that friend code. Check the characters and try again.';
  end if;

  if not v_link.is_active then
    if p_log_attempts then insert into friend_code_events (code_id, actor_id, event_type, success) values (v_link.id, p_viewer, 'validate_attempt', false); end if;
    raise exception 'This code is no longer active.';
  end if;

  if v_link.expires_at is not null and v_link.expires_at < now() then
    if p_log_attempts then insert into friend_code_events (code_id, actor_id, event_type, success) values (v_link.id, p_viewer, 'validate_attempt', false); end if;
    raise exception 'This code has expired. Ask your friend to generate a new one.';
  end if;

  if v_link.use_count >= v_link.max_uses then
    if p_log_attempts then insert into friend_code_events (code_id, actor_id, event_type, success) values (v_link.id, p_viewer, 'validate_attempt', false); end if;
    raise exception 'This one-time code has already been used.';
  end if;

  if v_link.created_by = p_viewer then
    if p_log_attempts then insert into friend_code_events (code_id, actor_id, event_type, success) values (v_link.id, p_viewer, 'validate_attempt', false); end if;
    raise exception 'That''s your own friend code.';
  end if;

  if is_friend(v_link.created_by, p_viewer) then
    if p_log_attempts then insert into friend_code_events (code_id, actor_id, event_type, success) values (v_link.id, p_viewer, 'validate_attempt', false); end if;
    raise exception 'You''re already connected on Bloom.';
  end if;

  if is_blocked(v_link.created_by, p_viewer) then
    if p_log_attempts then insert into friend_code_events (code_id, actor_id, event_type, success) values (v_link.id, p_viewer, 'validate_attempt', false); end if;
    raise exception 'This connection cannot be completed.';
  end if;

  if p_log_attempts then insert into friend_code_events (code_id, actor_id, event_type, success) values (v_link.id, p_viewer, 'validate_attempt', true); end if;

  return v_link;
end;
$$;
