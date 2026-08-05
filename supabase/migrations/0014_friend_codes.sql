-- =====================================================================
-- Bloom — Friend Code system, replacing the invite-by-link mechanism
-- (friend_invite_links + preview_friend_invite_link/accept_friend_invite_link),
-- which required a standalone route outside the authenticated app shell and
-- crashed in production (useCelebration() called with no CelebrationProvider
-- ancestor on that route). Code entry happens on /app/friends itself, inside
-- the app shell, eliminating that whole class of bug.
--
-- The flow terminates into the EXISTING friend_requests/friendships/
-- accept_friend_request system unchanged — a code never creates a
-- friendship directly, only a pending friend_requests row.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Drop the old link mechanism
-- ---------------------------------------------------------------------
drop function if exists accept_friend_invite_link(text);
drop function if exists preview_friend_invite_link(text);
drop table if exists friend_invite_links;

-- ---------------------------------------------------------------------
-- friend_codes — plaintext code is never persisted, only its hash.
-- ---------------------------------------------------------------------
create table if not exists friend_codes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  code_hash bytea not null,
  code_hint text not null,
  is_active boolean not null default true,
  expires_at timestamptz,
  max_uses integer not null default 1 check (max_uses in (1, 5, 10)),
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_friend_codes_created_by on friend_codes(created_by);
create index if not exists idx_friend_codes_hash on friend_codes(code_hash);
create unique index if not exists uq_friend_codes_active_hash on friend_codes(code_hash) where is_active;

drop trigger if exists trg_friend_codes_updated_at on friend_codes;
create trigger trg_friend_codes_updated_at before update on friend_codes
  for each row execute function set_updated_at();

alter table friend_codes enable row level security;

drop policy if exists "friend_codes_select" on friend_codes;
create policy "friend_codes_select" on friend_codes for select
  using (auth.uid() = created_by);

-- No insert/update policy: every mutation goes through the SECURITY
-- DEFINER RPCs below, never a direct client write.

-- ---------------------------------------------------------------------
-- friend_code_events — append-only audit trail + rate-limit source.
-- Never stores the raw code or its hash.
-- ---------------------------------------------------------------------
create table if not exists friend_code_events (
  id uuid primary key default gen_random_uuid(),
  code_id uuid references friend_codes(id) on delete set null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'validate_attempt', 'used', 'revoked', 'regenerated')),
  success boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_friend_code_events_actor_type_created
  on friend_code_events(actor_id, event_type, created_at desc);

alter table friend_code_events enable row level security;

drop policy if exists "friend_code_events_select" on friend_code_events;
create policy "friend_code_events_select" on friend_code_events for select
  using (auth.uid() = actor_id);

-- ---------------------------------------------------------------------
-- Helpers (internal — not directly grantable to clients)
-- ---------------------------------------------------------------------
create or replace function normalize_friend_code(p_input text)
returns text
language sql
immutable
as $$
  select regexp_replace(regexp_replace(upper(trim(p_input)), '^BLOOM-?', ''), '[^A-Z0-9]', '', 'g');
$$;

create or replace function generate_random_friend_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- excludes 0 O I 1 L
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function check_friend_code_rate_limit(p_actor uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from friend_code_events
  where actor_id = p_actor
    and event_type = 'validate_attempt'
    and created_at > now() - interval '10 minutes';
  if v_count >= 5 then
    raise exception 'Too many attempts. Take a short break and try again.';
  end if;
end;
$$;

-- Shared creation logic used by create_friend_code and regenerate_friend_code.
create or replace function create_friend_code_internal(p_owner uuid, p_expires_in text, p_max_uses int)
returns table (code text, id uuid, expires_at timestamptz, max_uses int)
language plpgsql
security definer set search_path = public
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

-- Shared validation logic used by validate_friend_code and use_friend_code.
-- Checks are ordered so structural validity (exists / active / not expired /
-- not exhausted) always resolves before anything identity-revealing
-- (self-use / already-friends / blocked) — a code doesn't reveal whose it
-- is until it's fully valid.
create or replace function validate_friend_code_row(p_code text, p_viewer uuid, p_log_attempts boolean)
returns friend_codes
language plpgsql
security definer set search_path = public
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

-- ---------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------
create or replace function create_friend_code(p_expires_in text default '7d', p_max_uses int default 1)
returns table (code text, id uuid, expires_at timestamptz, max_uses int)
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  return query select * from create_friend_code_internal(auth.uid(), p_expires_in, p_max_uses);
end;
$$;

create or replace function regenerate_friend_code(p_id uuid, p_expires_in text default '7d', p_max_uses int default 1)
returns table (code text, id uuid, expires_at timestamptz, max_uses int)
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select created_by into v_owner from friend_codes where id = p_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Friend code not found';
  end if;

  update friend_codes set is_active = false where id = p_id;
  insert into friend_code_events (code_id, actor_id, event_type, success) values (p_id, auth.uid(), 'regenerated', true);

  return query select * from create_friend_code_internal(auth.uid(), p_expires_in, p_max_uses);
end;
$$;

create or replace function revoke_friend_code(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select created_by into v_owner from friend_codes where id = p_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Friend code not found';
  end if;

  update friend_codes set is_active = false where id = p_id;
  insert into friend_code_events (code_id, actor_id, event_type, success) values (p_id, auth.uid(), 'revoked', true);
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
security definer set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_link friend_codes%rowtype;
begin
  if v_viewer is null then
    raise exception 'Authentication required';
  end if;

  v_link := validate_friend_code_row(p_code, v_viewer, true);

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
security definer set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_link friend_codes%rowtype;
  v_request_id uuid;
begin
  if v_viewer is null then
    raise exception 'Authentication required';
  end if;

  -- Re-validate (state can drift between preview and this click) without
  -- double-logging a second validate_attempt for the same visit.
  v_link := validate_friend_code_row(p_code, v_viewer, false);

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

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on table friend_codes from public, anon;
grant select on table friend_codes to authenticated;

revoke all on table friend_code_events from public, anon;
grant select on table friend_code_events to authenticated;

revoke execute on function create_friend_code(text, int) from public, anon;
grant execute on function create_friend_code(text, int) to authenticated;

revoke execute on function regenerate_friend_code(uuid, text, int) from public, anon;
grant execute on function regenerate_friend_code(uuid, text, int) to authenticated;

revoke execute on function revoke_friend_code(uuid) from public, anon;
grant execute on function revoke_friend_code(uuid) to authenticated;

revoke execute on function validate_friend_code(text) from public, anon;
grant execute on function validate_friend_code(text) to authenticated;

revoke execute on function use_friend_code(text) from public, anon;
grant execute on function use_friend_code(text) to authenticated;

-- Internal-only: take a p_viewer/p_actor parameter rather than reading
-- auth.uid() themselves, so they must never be directly callable by clients
-- (a caller could otherwise pass an arbitrary victim id).
revoke all on function validate_friend_code_row(text, uuid, boolean) from public, anon, authenticated;
revoke all on function create_friend_code_internal(uuid, text, int) from public, anon, authenticated;
revoke all on function check_friend_code_rate_limit(uuid) from public, anon, authenticated;
