create table if not exists public.youtube_tutorial_cache (
  canonical_exercise text primary key,
  payload jsonb not null,
  source_version text not null,
  verified_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(canonical_exercise) between 1 and 160),
  check (expires_at > verified_at),
  check (expires_at <= verified_at + interval '30 days')
);

alter table public.youtube_tutorial_cache enable row level security;
revoke all on public.youtube_tutorial_cache from public, anon, authenticated;
grant select, insert, update, delete on public.youtube_tutorial_cache to service_role;

comment on table public.youtube_tutorial_cache is
  'Global non-user-linked YouTube Data API cache. Entries must be revalidated within 24 hours and removed by 30 days.';

do $function$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'form-youtube-tutorial-cache-expiry'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'form-youtube-tutorial-cache-expiry',
    '17 * * * *',
    $command$delete from public.youtube_tutorial_cache where expires_at <= now()$command$
  );
end;
$function$;
