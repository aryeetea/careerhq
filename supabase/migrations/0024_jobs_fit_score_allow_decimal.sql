-- The AI Career Coach contract (schemas.ts's candidateFitSchema, matching
-- the restored careerCoach.ts prompt) returns fitScore as a float 0.0-10.0
-- ("When evidence exists, fitScore must be a number from 0.0 to 10.0").
-- jobs.fit_score was still `smallint` (integers only) — every real analysis
-- returning a decimal score (the normal case) would fail to save with
-- "invalid input syntax for type smallint". Widen to numeric(3,1); the
-- existing 0-10 check constraint already covers the valid range generically
-- and needs no change.
alter table jobs alter column fit_score type numeric(3,1) using fit_score::numeric(3,1);
