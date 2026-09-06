-- PostgreSQL has no min(uuid) aggregate. Cast through text for the legacy
-- single-attempt fallback, where the count guard is the actual invariant.
do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.start_analysis_attempt(uuid,uuid,uuid)'::regprocedure) into v_definition;
  if strpos(v_definition,'min(attempt.id)')=0 then raise exception 'ATTEMPT_START_DEFINITION_NOT_RECOGNIZED'; end if;
  execute replace(v_definition,'min(attempt.id)','min(attempt.id::text)::uuid');
end $$;

-- Use the established stale-reservation release function in the hourly job.
create or replace function public.run_business_reporting_maintenance()
returns void language plpgsql security definer set search_path='' as $$
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  perform public.release_stale_analysis_credit_reservations();
  update public.referral_bonus_grants grant_row
  set state='expired'
  where grant_row.state='active' and grant_row.period_end<=now();
  perform public.refresh_business_daily_metrics((now() at time zone 'America/New_York')::date);
end $$;

revoke all on function public.run_business_reporting_maintenance() from public,anon,authenticated;
grant execute on function public.run_business_reporting_maintenance() to service_role;
