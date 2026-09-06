-- Reporting must cover sessions created before the durable attempt ledger was
-- introduced, without manufacturing reservations or changing user quota.
create or replace view public.business_analysis_activity as
select attempt.id,attempt.reservation_id,attempt.session_id,attempt.user_id,
  attempt.kind,attempt.status,attempt.started_at,attempt.terminal_at,
  attempt.created_at,attempt.updated_at
from public.analysis_attempts attempt
union all
select session.id,null::uuid,session.id,session.user_id,
  case when session.previous_session_id is null then 'analysis' else 'reanalysis' end,
  session.status,session.analysis_started_at,coalesce(session.completed_at,session.updated_at),
  session.created_at,session.updated_at
from public.analysis_sessions session
where session.status in ('complete','partial','unable','failed')
  and not exists(select 1 from public.analysis_attempts attempt where attempt.session_id=session.id);

revoke all on public.business_analysis_activity from public,anon,authenticated;
grant select on public.business_analysis_activity to service_role;

do $$
declare item record; definition text;
begin
  for item in
    select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (
      p.proname like 'business_%' or p.proname like 'get_founder_business_dashboard%'
      or p.proname='refresh_business_daily_metrics'
    ) and p.prosrc like '%public.analysis_attempts%'
  loop
    definition:=pg_get_functiondef(item.oid);
    execute replace(definition,'public.analysis_attempts','public.business_analysis_activity');
  end loop;
end $$;

do $$
declare day date;
begin
  for day in select distinct metric_date from public.business_daily_metrics loop
    perform public.refresh_business_daily_metrics(day);
  end loop;
end $$;
