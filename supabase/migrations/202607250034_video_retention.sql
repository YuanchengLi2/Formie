alter table public.user_profiles
  add column if not exists video_retention_days integer
  check (video_retention_days is null or video_retention_days = 30),
  add column if not exists retention_effective_at timestamptz;

alter table public.user_profiles
  drop constraint if exists user_profiles_retention_consistency;

alter table public.user_profiles
  add constraint user_profiles_retention_consistency check (
    (video_retention_days is null and retention_effective_at is null)
    or
    (video_retention_days = 30 and retention_effective_at is not null)
  );

create index if not exists analysis_sessions_retention_cleanup_idx
  on public.analysis_sessions (user_id, created_at)
  where video_path is not null;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.configure_video_retention_cleanup(
  p_project_url text,
  p_cron_secret text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  project_secret_id uuid;
  cron_secret_id uuid;
  existing_job_id bigint;
begin
  if p_project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then
    raise exception 'Invalid project URL';
  end if;
  if char_length(p_cron_secret) < 32 then
    raise exception 'Cleanup secret is too short';
  end if;

  select id into project_secret_id
  from vault.decrypted_secrets
  where name = 'form_retention_project_url'
  limit 1;
  if project_secret_id is null then
    perform vault.create_secret(p_project_url, 'form_retention_project_url', 'FORM retention cleanup project URL');
  else
    perform vault.update_secret(project_secret_id, p_project_url, 'form_retention_project_url', 'FORM retention cleanup project URL');
  end if;

  select id into cron_secret_id
  from vault.decrypted_secrets
  where name = 'form_retention_cron_secret'
  limit 1;
  if cron_secret_id is null then
    perform vault.create_secret(p_cron_secret, 'form_retention_cron_secret', 'FORM retention cleanup authentication');
  else
    perform vault.update_secret(cron_secret_id, p_cron_secret, 'form_retention_cron_secret', 'FORM retention cleanup authentication');
  end if;

  for existing_job_id in
    select jobid from cron.job where jobname = 'form-video-retention-daily'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'form-video-retention-daily',
    '17 4 * * *',
    $command$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'form_retention_project_url')
          || '/functions/v1/cleanup-expired-analyses',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'form_retention_cron_secret')
        ),
        body := '{}'::jsonb
      ) as request_id;
    $command$
  );
end;
$function$;

revoke all on function public.configure_video_retention_cleanup(text, text)
from public, anon, authenticated;
grant execute on function public.configure_video_retention_cleanup(text, text)
to service_role;
