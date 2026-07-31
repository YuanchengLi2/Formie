create table if not exists public.support_request_rate_limits (
  request_id uuid primary key,
  ip_hash text not null check (length(ip_hash) = 64),
  email_hash text not null check (length(email_hash) = 64),
  category text not null check (category in ('account', 'billing', 'bug', 'feature', 'other')),
  delivery_status text not null default 'reserved' check (delivery_status in ('reserved', 'sent', 'failed')),
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists support_request_rate_limits_ip_created_idx
  on public.support_request_rate_limits (ip_hash, created_at desc);

create index if not exists support_request_rate_limits_email_created_idx
  on public.support_request_rate_limits (email_hash, created_at desc);

alter table public.support_request_rate_limits enable row level security;
revoke all on table public.support_request_rate_limits from anon, authenticated;

create or replace function public.reserve_support_request(
  p_request_id uuid,
  p_ip_hash text,
  p_email_hash text,
  p_category text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  if length(p_ip_hash) <> 64 or length(p_email_hash) <> 64 then
    raise exception 'invalid support rate-limit hash';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('support-ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('support-email:' || p_email_hash, 0));

  if (
    select count(*)
    from public.support_request_rate_limits
    where ip_hash = p_ip_hash
      and created_at >= now() - interval '1 hour'
  ) >= 3 then
    return 'ip';
  end if;

  if (
    select count(*)
    from public.support_request_rate_limits
    where email_hash = p_email_hash
      and created_at >= now() - interval '1 day'
  ) >= 5 then
    return 'email';
  end if;

  insert into public.support_request_rate_limits (
    request_id,
    ip_hash,
    email_hash,
    category
  ) values (
    p_request_id,
    p_ip_hash,
    p_email_hash,
    p_category
  );

  return 'allowed';
end;
$$;

revoke all on function public.reserve_support_request(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_support_request(uuid, text, text, text) to service_role;
