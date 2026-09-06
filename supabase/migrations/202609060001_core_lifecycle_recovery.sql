-- One customer population for all founder cohorts, totals, and daily rollups.
-- Anonymous Supabase sessions are installation identities, not signed-up users.
create or replace view public.business_customer_accounts as
select id,created_at from auth.users where not coalesce(is_anonymous,false);
revoke all on public.business_customer_accounts from public,anon,authenticated;
grant select on public.business_customer_accounts to service_role;

do $$
declare item record; definition text;
begin
  for item in
    select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (
      p.proname like 'business_%' or p.proname like 'get_founder_business_dashboard%'
      or p.proname='refresh_business_daily_metrics'
    ) and p.prosrc like '%auth.users%'
  loop
    definition:=pg_get_functiondef(item.oid);
    execute replace(definition,'auth.users','public.business_customer_accounts');
  end loop;
end $$;

-- Distinguish a genuinely pending projection from an older event whose financial
-- payload was never retained. Never invent prices or call missing data complete.
do $$
declare definition text; old_predicate text:='where financial_projection_status<>''completed'' having count(*)>0';
begin
  select pg_get_functiondef('public.get_founder_business_dashboard(text,text,date,date)'::regprocedure) into definition;
  if strpos(definition,old_predicate)=0 then raise exception 'BILLING_ALERT_DEFINITION_NOT_RECOGNIZED'; end if;
  definition:=replace(definition,old_predicate,
    'where financial_projection_status in (''pending'',''failed'') and raw_event is not null having count(*)>0
    union all select jsonb_build_object(''key'',''legacy_billing_coverage'',''severity'',''warning'',''message'',count(*)::text||'' historical billing events lack retained financial payloads; revenue history is incomplete'') from public.revenuecat_webhook_events where financial_projection_status=''pending'' and raw_event is null having count(*)>0');
  execute definition;
end $$;

-- A reservation timeout alone cannot finish an interrupted session. Recover
-- abandoned sessions under row locks while respecting all active worker leases.
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
      and not exists(select 1 from public.analysis_jobs job where job.session_id=session.id and job.lease_until>now())
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

select cron.schedule('formie-stalled-analysis-recovery','*/10 * * * *','select public.expire_stalled_analysis_sessions()');

-- Recompute previously stored daily signup counts using the corrected population.
do $$
declare day date;
begin
  for day in select distinct metric_date from public.business_daily_metrics loop
    perform public.refresh_business_daily_metrics(day);
  end loop;
end $$;
