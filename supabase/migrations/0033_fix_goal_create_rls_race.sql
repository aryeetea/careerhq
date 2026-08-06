-- Goal creation failed on every attempt with "new row violates row-level
-- security policy for table \"goals\"" — the exact same bug class as
-- 0032's groups fix, in the same shape:
--
-- createGoal() does INSERT ... RETURNING (.insert({...}).select("*").single()).
-- Postgres checks the table's SELECT policy against the RETURNING row.
-- goals_select was `is_goal_member(id, auth.uid()) OR (is_shared AND
-- is_friend(owner_id, auth.uid()))`. For a private goal (is_shared=false,
-- the default), the only path is is_goal_member(id, auth.uid()), which
-- needs a goal_members row — created by trg_goals_add_owner, an AFTER
-- INSERT trigger. AFTER ROW triggers fire at the end of the statement,
-- after the RETURNING row has already been checked. Confirmed live and
-- directly in SQL: a plain INSERT (no RETURNING) always succeeded, with
-- the trigger's membership row present immediately after; only
-- INSERT ... RETURNING failed.
--
-- Fix: let the owner see their own goal directly, same as 0032 did for
-- groups. Doesn't weaken anything — the owner is always entitled to see
-- their own goal — and removes the dependency on trigger timing.
alter policy goals_select on goals
  using (is_goal_member(id, auth.uid()) or auth.uid() = owner_id or (is_shared and is_friend(owner_id, auth.uid())));

-- Same bug, one hop over: joinGoal() does the same INSERT ... RETURNING
-- shape against goal_members directly (no trigger involved this time —
-- the row being inserted *is* the membership row), and the same
-- within-statement visibility rule applies: a sub-SELECT inside the
-- RETURNING check for an INSERT does not see the row that very statement
-- is inserting. goal_members_select's is_goal_member(goal_id, auth.uid())
-- check was therefore always false for your own just-inserted row,
-- breaking "join a friend's shared goal" the same way. Confirmed live:
-- plain INSERT (no RETURNING) succeeded; INSERT ... RETURNING failed.
-- Fix: let a member see their own membership row directly.
alter policy goal_members_select on goal_members
  using (
    auth.uid() = user_id
    or is_goal_member(goal_id, auth.uid())
    or exists (select 1 from goals g where g.id = goal_members.goal_id and g.owner_id = auth.uid())
  );
