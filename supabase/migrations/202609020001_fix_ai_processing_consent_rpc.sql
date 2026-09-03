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

  update public.user_consents as existing
  set revoked_at = now()
  where existing.user_id = v_user_id
    and existing.kind = 'ai_processing'
    and existing.revoked_at is null;

  return query
  insert into public.user_consents as recorded (user_id, kind, version, notice_sha256)
  values (v_user_id, 'ai_processing', btrim(p_version), p_notice_sha256)
  returning recorded.version, recorded.notice_sha256, recorded.accepted_at, recorded.revoked_at;
end;
$$;

revoke all on function public.record_ai_processing_consent(text, text) from public, anon;
grant execute on function public.record_ai_processing_consent(text, text) to authenticated;
