create table if not exists public.apple_authorizations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  apple_subject text not null unique,
  encrypted_refresh_token text not null check (encrypted_refresh_token like 'v1.%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.apple_authorizations enable row level security;
revoke all on public.apple_authorizations from public, anon, authenticated;
grant select, insert, update, delete on public.apple_authorizations to service_role;

create or replace function public.resolve_apple_identity_user_id(p_subject text)
returns uuid
language sql
security definer
set search_path = ''
stable
as $function$
  select identity.user_id
  from auth.identities identity
  where identity.provider = 'apple'
    and (
      identity.identity_data ->> 'sub' = p_subject
      or identity.id::text = p_subject
    )
  order by identity.created_at
  limit 1
$function$;

revoke all on function public.resolve_apple_identity_user_id(text) from public, anon, authenticated;
grant execute on function public.resolve_apple_identity_user_id(text) to service_role;

create table if not exists public.external_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  provider text not null check (provider in ('apple', 'gemini', 'revenuecat')),
  operation text not null check (operation in ('revoke_authorization', 'delete_file', 'delete_customer')),
  encrypted_payload text not null check (encrypted_payload like 'v1.%'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  attempts integer not null default 0 check (attempts between 0 and 12),
  next_retry_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'terminal_failed')),
  last_error_code text,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, operation, fingerprint)
);

create index if not exists external_deletion_jobs_due_idx
  on public.external_deletion_jobs (next_retry_at, created_at)
  where status = 'pending';

alter table public.external_deletion_jobs enable row level security;
revoke all on public.external_deletion_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.external_deletion_jobs to service_role;

comment on table public.external_deletion_jobs is
  'Encrypted, service-role-only retry queue for processor deletion. Rows are removed immediately after success.';

create or replace function public.claim_external_deletion_jobs(p_limit integer default 25)
returns setof public.external_deletion_jobs
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query
  with claimed as (
    select job.id
    from public.external_deletion_jobs job
    where (job.status = 'pending' and job.next_retry_at <= now())
       or (job.status = 'processing' and job.updated_at <= now() - interval '15 minutes')
    order by job.next_retry_at, job.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.external_deletion_jobs job
  set status = 'processing', updated_at = now()
  from claimed
  where job.id = claimed.id
  returning job.*;
end;
$function$;

revoke all on function public.claim_external_deletion_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_external_deletion_jobs(integer) to service_role;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.configure_external_deletion_worker(p_project_url text, p_cron_secret text)
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
  if p_project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then raise exception 'Invalid project URL'; end if;
  if char_length(p_cron_secret) < 32 then raise exception 'Cleanup secret is too short'; end if;

  select id into project_secret_id from vault.decrypted_secrets where name = 'form_external_deletion_project_url' limit 1;
  if project_secret_id is null then perform vault.create_secret(p_project_url, 'form_external_deletion_project_url', 'Formie external deletion project URL');
  else perform vault.update_secret(project_secret_id, p_project_url, 'form_external_deletion_project_url', 'Formie external deletion project URL'); end if;

  select id into cron_secret_id from vault.decrypted_secrets where name = 'form_external_deletion_cron_secret' limit 1;
  if cron_secret_id is null then perform vault.create_secret(p_cron_secret, 'form_external_deletion_cron_secret', 'Formie external deletion worker authentication');
  else perform vault.update_secret(cron_secret_id, p_cron_secret, 'form_external_deletion_cron_secret', 'Formie external deletion worker authentication'); end if;

  for existing_job_id in select jobid from cron.job where jobname = 'form-external-deletion-worker' loop perform cron.unschedule(existing_job_id); end loop;
  perform cron.schedule('form-external-deletion-worker', '* * * * *', $command$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'form_external_deletion_project_url') || '/functions/v1/process-external-deletions',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'form_external_deletion_cron_secret')),
      body := '{}'::jsonb
    ) as request_id;
  $command$);
end;
$function$;

revoke all on function public.configure_external_deletion_worker(text, text) from public, anon, authenticated;
grant execute on function public.configure_external_deletion_worker(text, text) to service_role;
