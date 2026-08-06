-- A concurrent analyzer invocation can finish after commit_analysis_result_v2
-- has already persisted a terminal result. Repair historical rows that were
-- regressed to processing/finalizing; the edge function now also prevents the
-- non-terminal stage write that caused the race.
update public.analysis_sessions as session
set status = result.status,
    stage = 'complete',
    failure_code = null,
    analysis_retry_count = 0,
    analysis_next_retry_at = null,
    analysis_last_error_code = null,
    completed_at = coalesce(session.completed_at, result.created_at, now()),
    updated_at = now()
from public.analysis_results as result
where result.session_id = session.id
  and result.status in ('complete', 'partial', 'unable')
  and session.status not in ('complete', 'partial', 'unable');
