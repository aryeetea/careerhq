-- Pins search_path on the two friend-code helpers that were missing it in
-- 0014 (flagged by the Supabase security linter as function_search_path_mutable).
create or replace function normalize_friend_code(p_input text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(regexp_replace(upper(trim(p_input)), '^BLOOM-?', ''), '[^A-Z0-9]', '', 'g');
$$;

create or replace function generate_random_friend_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;
