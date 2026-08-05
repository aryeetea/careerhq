create table if not exists group_join_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  is_active boolean not null default true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_group_join_links_group_id on group_join_links(group_id);
create index if not exists idx_group_join_links_token on group_join_links(token);

drop trigger if exists trg_group_join_links_updated_at on group_join_links;
create trigger trg_group_join_links_updated_at before update on group_join_links
  for each row execute function set_updated_at();

alter table group_join_links enable row level security;

drop policy if exists "group_join_links_select" on group_join_links;
create policy "group_join_links_select" on group_join_links for select
  using (is_group_member(group_id, auth.uid()));

drop policy if exists "group_join_links_insert" on group_join_links;
create policy "group_join_links_insert" on group_join_links for insert
  with check (auth.uid() = created_by and is_group_member(group_id, auth.uid()));

drop policy if exists "group_join_links_update" on group_join_links;
create policy "group_join_links_update" on group_join_links for update
  using (auth.uid() = created_by or exists (select 1 from groups g where g.id = group_id and g.owner_id = auth.uid()))
  with check (auth.uid() = created_by or exists (select 1 from groups g where g.id = group_id and g.owner_id = auth.uid()));

create or replace function preview_group_join_link(p_token text)
returns table (
  group_id uuid,
  group_name text,
  group_description text,
  member_count bigint,
  is_active boolean,
  expires_at timestamptz
)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  select
    g.id,
    g.name,
    g.description,
    count(gm.id)::bigint,
    gjl.is_active,
    gjl.expires_at
  from group_join_links gjl
  join groups g on g.id = gjl.group_id
  left join group_members gm on gm.group_id = g.id
  where gjl.token = p_token
  group by g.id, g.name, g.description, gjl.is_active, gjl.expires_at;
end;
$$;

create or replace function join_group_via_link(p_token text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_link group_join_links%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_link
  from group_join_links
  where token = p_token
  for update;

  if v_link.id is null then
    raise exception 'Invite link not found';
  end if;

  if not v_link.is_active then
    raise exception 'This invite link is no longer active';
  end if;

  if v_link.expires_at is not null and v_link.expires_at < now() then
    raise exception 'This invite link has expired';
  end if;

  insert into group_members (group_id, user_id, role)
  values (v_link.group_id, auth.uid(), 'member')
  on conflict do nothing;

  update group_join_links
  set last_used_at = now()
  where id = v_link.id;

  return v_link.group_id;
end;
$$;

revoke all on table group_join_links from public, anon;
grant select, insert, update on table group_join_links to authenticated;

revoke execute on function preview_group_join_link(text) from public;
grant execute on function preview_group_join_link(text) to anon, authenticated;

revoke execute on function join_group_via_link(text) from public, anon;
grant execute on function join_group_via_link(text) to authenticated;
