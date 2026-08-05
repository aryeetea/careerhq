-- No longer called — the rate-limit check is inlined directly in
-- validate_friend_code now (see 0018).
drop function if exists check_friend_code_rate_limit(uuid);
