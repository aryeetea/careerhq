-- Real bug, confirmed live: regenerate_friend_code's own return signature
-- (`returns table (code text, id uuid, ...)`) makes `id` an implicit
-- PL/pgSQL variable for the whole function body, so `where id = p_id`
-- is ambiguous between that variable and the friend_codes.id column —
-- every call raised `42702: column reference "id" is ambiguous`, caught
-- client-side as "Couldn't create a new code." This is why Disable (which
-- returns void, no such shadowing) worked but Regenerate never did.
create or replace function regenerate_friend_code(p_id uuid, p_expires_in text default '7d', p_max_uses int default 1)
returns table (code text, id uuid, expires_at timestamptz, max_uses int)
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select fc.created_by into v_owner from friend_codes fc where fc.id = p_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Friend code not found';
  end if;

  update friend_codes fc set is_active = false where fc.id = p_id;
  insert into friend_code_events (code_id, actor_id, event_type, success) values (p_id, auth.uid(), 'regenerated', true);

  return query select * from create_friend_code_internal(auth.uid(), p_expires_in, p_max_uses);
end;
$$;
