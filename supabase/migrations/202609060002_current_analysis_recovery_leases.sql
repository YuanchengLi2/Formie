-- The legacy analysis_jobs table was retired. Recovery now relies only on the
-- current durable stage leases and v49 run heartbeat.
create or replace function public.expire_stalled_analysis_sessions()
returns integer language plpgsql security definer set search_path='' as $$
declare target public.analysis_sessions%rowtype; saved public.analysis_results%rowtype;
  recovered integer:=0; cutoff timestamptz:=now()-interval '2 hours'; attempt_started timestamptz;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  for target in
    select session.* from public.analysis_sessions session
    where session.status in ('created','uploading','queued','processing') and session.updated_at<cutoff
      and (session.analysis_next_retry_at is null or session.analysis_next_retry_at<=now())
      and not exists(select 1 from public.analysis_stage_runs stage where stage.session_id=session.id and (stage.lease_expires_at>now() or stage.updated_at>=cutoff))
      and not exists(select 1 from public.analysis_v49_runs run where run.run_id=session.active_v49_run_id and run.updated_at>=cutoff)
    order by session.updated_at limit 100 for update of session skip locked
  loop
    select coalesce(started_at,created_at) into attempt_started from public.analysis_attempts where id=target.active_attempt_id;
    select * into saved from public.analysis_results result
      where result.session_id=target.id and result.status in ('complete','partial','unable')
        and result.created_at>=coalesce(attempt_started,target.analysis_started_at,target.created_at);
    update public.analysis_sessions
      set status=coalesce(saved.status,'failed'),stage=case when saved.status is null then 'failed' else 'complete' end,
          failure_code=case when saved.status is null then 'ANALYSIS_INTERRUPTED' else null end,
          analysis_next_retry_at=null,completed_at=coalesce(saved.created_at,now()),updated_at=now()
      where id=target.id;
    perform public.reconcile_analysis_credit_for_session(target.id);
    update public.analysis_credit_reservations set status='cancelled',cancelled_at=coalesce(cancelled_at,now()),expires_at=least(expires_at,now())
      where session_id=target.id and status='reserved';
    recovered:=recovered+1;
  end loop;
  return recovered;
end $$;
revoke all on function public.expire_stalled_analysis_sessions() from public,anon,authenticated;
grant execute on function public.expire_stalled_analysis_sessions() to service_role;
