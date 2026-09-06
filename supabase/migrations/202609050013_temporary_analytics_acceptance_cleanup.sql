-- Service-only cleanup for the isolated Edge Function acceptance event. The
-- next migration removes this helper after the journey is complete.
create or replace function public.cleanup_analytics_acceptance_fixture(p_anonymous_id uuid,p_event_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if exists(select 1 from public.analytics_installations installation where installation.anonymous_id=p_anonymous_id and installation.linked_user_id is not null) then
    raise exception 'ACCEPTANCE_INSTALLATION_IS_LINKED';
  end if;
  if exists(select 1 from public.product_analytics_events event where event.client_event_id=p_event_id and (event.anonymous_id<>p_anonymous_id or event.app_version<>'acceptance-test')) then
    raise exception 'NOT_AN_ACCEPTANCE_FIXTURE';
  end if;
  delete from public.product_analytics_events event where event.client_event_id=p_event_id and event.anonymous_id=p_anonymous_id and event.app_version='acceptance-test';
  delete from public.analytics_installations installation where installation.anonymous_id=p_anonymous_id and installation.linked_user_id is null;
  delete from public.analytics_ingestion_limits bucket where bucket.bucket_kind='anonymous_day' and bucket.bucket_key=p_anonymous_id::text;
end $$;
revoke all on function public.cleanup_analytics_acceptance_fixture(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cleanup_analytics_acceptance_fixture(uuid,uuid) to service_role;
