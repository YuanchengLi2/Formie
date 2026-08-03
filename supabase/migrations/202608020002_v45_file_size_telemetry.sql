-- File size is observability data, not an analysis eligibility gate. Large
-- retained videos that Gemini accepted must not fail while v45 finalizes.
alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_analysis_input_byte_length_check;

alter table public.analysis_sessions
  alter column analysis_input_byte_length type bigint
  using analysis_input_byte_length::bigint;

alter table public.analysis_sessions
  add constraint analysis_sessions_analysis_input_byte_length_check
    check (analysis_input_byte_length is null or analysis_input_byte_length > 0);
