-- Dropping get_friend_card in 0021 (required to change its return shape)
-- reset it to Postgres's default grants, which include EXECUTE for PUBLIC
-- on newly created functions — silently exposing it to the anon role.
-- get_friend_card requires an authenticated, accepted friendship
-- (is_friend() raises otherwise), so this wasn't directly exploitable, but
-- it should never have been reachable by anon in the first place.
revoke execute on function get_friend_card(uuid) from public, anon;
grant execute on function get_friend_card(uuid) to authenticated;
