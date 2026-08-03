-- Provider output is diagnostic evidence and may be malformed. Store it before
-- strict parsing even when its top-level JSON type is not an object.
alter table public.analysis_v49_runs
  drop constraint if exists analysis_v49_runs_raw_problem_output_check,
  drop constraint if exists analysis_v49_runs_raw_writer_output_check;
