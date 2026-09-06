create or replace function public.cleanup_expired_external_deletion_jobs()
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  deleted_count bigint;
begin
  delete from public.external_deletion_jobs
  where expires_at <= now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

revoke all on function public.cleanup_expired_external_deletion_jobs() from public, anon, authenticated;
grant execute on function public.cleanup_expired_external_deletion_jobs() to service_role;

comment on function public.cleanup_expired_external_deletion_jobs() is
  'Deletes expired external-deletion queue rows, including terminal failures, so encrypted payloads never remain past their retention boundary.';

do $block$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'form-external-deletion-job-expiry'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'form-external-deletion-job-expiry',
    '7 * * * *',
    'select public.cleanup_expired_external_deletion_jobs()'
  );
end;
$block$;
