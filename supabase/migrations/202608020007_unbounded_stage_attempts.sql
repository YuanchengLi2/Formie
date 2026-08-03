-- v46 retries are durable and intentionally have no two-attempt lease cap.
-- The older constraint would make the third claim fail before Gemini was
-- called, leaving the session in retry_wait with no diagnosable contract
-- result.
alter table public.analysis_stage_runs
  drop constraint if exists analysis_stage_runs_attempt_check,
  add constraint analysis_stage_runs_attempt_nonnegative
    check (attempt >= 0);
