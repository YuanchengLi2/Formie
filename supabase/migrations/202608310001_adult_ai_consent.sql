alter table public.user_profiles
  drop constraint if exists user_profiles_age_years_check;

alter table public.user_profiles
  drop constraint if exists user_profiles_age_years_adult_check;

alter table public.user_profiles
  add constraint user_profiles_age_years_adult_check
  check (age_years is null or age_years between 18 and 100)
  not valid;

comment on constraint user_profiles_age_years_adult_check on public.user_profiles
  is 'New and updated profiles must be adult accounts. Existing legacy rows remain readable until separately resolved.';

create table if not exists public.ai_processing_notice_versions (
  version text primary key check (char_length(version) between 1 and 64),
  notice_sha256 text not null check (notice_sha256 ~ '^[a-f0-9]{64}$'),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (version, notice_sha256)
);

alter table public.ai_processing_notice_versions enable row level security;
revoke all on public.ai_processing_notice_versions from public, anon, authenticated;
grant select, insert, update, delete on public.ai_processing_notice_versions to service_role;

insert into public.ai_processing_notice_versions (version, notice_sha256, active)
values ('2026-09-01', '739cb7347c35cdf9e4bfec5588113dde724eff88d0b28b215745549dd9a2be20', true)
on conflict (version) do update
set notice_sha256 = excluded.notice_sha256,
    active = excluded.active;

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ai_processing')),
  version text not null check (char_length(version) between 1 and 64),
  notice_sha256 text not null check (notice_sha256 ~ '^[a-f0-9]{64}$'),
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (version, notice_sha256) references public.ai_processing_notice_versions(version, notice_sha256),
  check (revoked_at is null or revoked_at >= accepted_at)
);

create index if not exists user_consents_current_idx
  on public.user_consents (user_id, kind, accepted_at desc)
  where revoked_at is null;

alter table public.user_consents enable row level security;
revoke all on public.user_consents from public, anon, authenticated;
grant select, insert, update, delete on public.user_consents to service_role;

create or replace function public.record_ai_processing_consent(p_version text, p_notice_sha256 text)
returns table(version text, notice_sha256 text, accepted_at timestamptz, revoked_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'UNAUTHORIZED'; end if;
  if nullif(btrim(p_version), '') is null or char_length(btrim(p_version)) > 64 then raise exception 'INVALID_CONSENT_VERSION'; end if;
  if p_notice_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_NOTICE_HASH'; end if;
  if not exists (
    select 1
    from public.ai_processing_notice_versions notice
    where notice.version = btrim(p_version)
      and notice.notice_sha256 = p_notice_sha256
      and notice.active
  ) then raise exception 'INVALID_CONSENT_NOTICE'; end if;

  update public.user_consents
  set revoked_at = now()
  where user_id = v_user_id and kind = 'ai_processing' and revoked_at is null;

  return query
  insert into public.user_consents (user_id, kind, version, notice_sha256)
  values (v_user_id, 'ai_processing', btrim(p_version), p_notice_sha256)
  returning user_consents.version, user_consents.notice_sha256, user_consents.accepted_at, user_consents.revoked_at;
end;
$$;

create or replace function public.revoke_ai_processing_consent(p_version text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revoked_at timestamptz := now();
begin
  if v_user_id is null then raise exception 'UNAUTHORIZED'; end if;
  if nullif(btrim(p_version), '') is null or char_length(btrim(p_version)) > 64 then raise exception 'INVALID_CONSENT_VERSION'; end if;
  update public.user_consents
  set revoked_at = v_revoked_at
  where user_id = v_user_id and kind = 'ai_processing' and revoked_at is null;

  update public.analysis_sessions
  set status = 'failed',
      failure_code = 'AI_CONSENT_REVOKED',
      analysis_next_retry_at = null,
      completed_at = coalesce(completed_at, v_revoked_at)
  where user_id = v_user_id
    and (status in ('created', 'uploading', 'queued') or (status = 'processing' and stage = 'input_ready'))
    and gemini_file_name is null;
  return v_revoked_at;
end;
$$;

create or replace function public.current_ai_processing_consent()
returns table(version text, notice_sha256 text, accepted_at timestamptz, revoked_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select consent.version, consent.notice_sha256, consent.accepted_at, consent.revoked_at
  from public.user_consents consent
  where consent.user_id = auth.uid()
    and consent.kind = 'ai_processing'
    and consent.revoked_at is null
  order by consent.accepted_at desc
  limit 1
$$;

revoke all on function public.record_ai_processing_consent(text, text) from public, anon;
revoke all on function public.revoke_ai_processing_consent(text) from public, anon;
revoke all on function public.current_ai_processing_consent() from public, anon;
grant execute on function public.record_ai_processing_consent(text, text) to authenticated;
grant execute on function public.revoke_ai_processing_consent(text) to authenticated;
grant execute on function public.current_ai_processing_consent() to authenticated;
