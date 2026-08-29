-- Durable first-party product analytics. Raw tables remain private; the Edge
-- Function calls the service-only ingestion function after validating input.

alter table public.product_analytics_events
  add column if not exists client_event_id uuid,
  add column if not exists anonymous_id uuid,
  add column if not exists app_session_id uuid,
  add column if not exists capture_flow_id uuid,
  add column if not exists analysis_session_id uuid references public.analysis_sessions(id) on delete cascade,
  add column if not exists occurred_at timestamptz,
  add column if not exists app_version text,
  add column if not exists build_number text,
  add column if not exists platform text,
  add column if not exists received_at timestamptz not null default now();

update public.product_analytics_events set occurred_at = coalesce(occurred_at, created_at) where occurred_at is null;
alter table public.product_analytics_events alter column occurred_at set default now();

alter table public.product_analytics_events drop constraint if exists product_analytics_events_event_name_check;
alter table public.product_analytics_events add constraint product_analytics_events_event_name_check check (event_name in (
  'app_session_started', 'onboarding_screen_viewed', 'onboarding_cta_pressed', 'onboarding_demo_tab_opened',
  'paywall_viewed', 'purchase_started', 'purchase_succeeded', 'purchase_cancelled', 'purchase_failed', 'purchase_restored',
  'subscription_management_intent', 'subscription_management_opened', 'analysis_reservation_denied', 'analysis_cancelled',
  'exercise_selected', 'recording_started', 'recording_completed', 'recording_failed', 'upload_started',
  'analysis_result_viewed', 'feedback_prompt_viewed', 'coaching_section_viewed',
  'record_another_set_clicked', 'reanalysis_started'
));

create unique index if not exists product_analytics_client_event_uidx on public.product_analytics_events(client_event_id) where client_event_id is not null;
create index if not exists product_analytics_event_time_idx on public.product_analytics_events(event_name, occurred_at desc);
create index if not exists product_analytics_user_event_time_idx on public.product_analytics_events(user_id, event_name, occurred_at desc);
create index if not exists product_analytics_anonymous_time_idx on public.product_analytics_events(anonymous_id, occurred_at desc);
create index if not exists product_analytics_capture_flow_idx on public.product_analytics_events(capture_flow_id, occurred_at);
create index if not exists product_analytics_analysis_session_idx on public.product_analytics_events(analysis_session_id, occurred_at);
create index if not exists product_analytics_app_session_idx on public.product_analytics_events(app_session_id, occurred_at);

create table if not exists public.analytics_identity_links (
  anonymous_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now()
);
alter table public.analytics_identity_links enable row level security;
create index if not exists analytics_identity_links_user_idx on public.analytics_identity_links(user_id);

alter table public.analysis_sessions
  add column if not exists capture_flow_id uuid,
  add column if not exists app_session_id uuid;
create index if not exists analysis_sessions_capture_flow_idx on public.analysis_sessions(capture_flow_id) where capture_flow_id is not null;
create index if not exists analysis_sessions_app_session_idx on public.analysis_sessions(app_session_id, created_at) where app_session_id is not null;

create table if not exists public.analytics_ingestion_limits (
  bucket_kind text not null check (bucket_kind in ('ip_hour', 'anonymous_day')),
  bucket_key text not null,
  bucket_start timestamptz not null,
  event_count integer not null check (event_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (bucket_kind, bucket_key, bucket_start)
);
alter table public.analytics_ingestion_limits enable row level security;

create or replace function public.ingest_product_analytics_v2(p_user_id uuid, p_ip_hash text, p_events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_ip_total integer;
  v_event jsonb;
  v_event_id uuid;
  v_anonymous_id uuid;
  v_analysis_id uuid;
  v_existing_user uuid;
  v_occurred_at timestamptz;
  v_accepted jsonb := '[]'::jsonb;
  v_allowed_keys text[];
begin
  if p_ip_hash is null or length(p_ip_hash) <> 64 or p_ip_hash !~ '^[0-9a-f]+$' then raise exception 'INVALID_IP_HASH'; end if;
  if jsonb_typeof(p_events) <> 'array' then raise exception 'INVALID_EVENTS'; end if;
  v_count := jsonb_array_length(p_events);
  if v_count < 1 or v_count > 25 then raise exception 'INVALID_BATCH_SIZE'; end if;

  insert into public.analytics_ingestion_limits(bucket_kind, bucket_key, bucket_start, event_count)
  values ('ip_hour', p_ip_hash, date_trunc('hour', now()), v_count)
  on conflict (bucket_kind, bucket_key, bucket_start) do update set event_count = public.analytics_ingestion_limits.event_count + excluded.event_count, updated_at = now()
  returning event_count into v_ip_total;
  if v_ip_total > 300 then raise exception 'RATE_LIMIT_IP'; end if;

  for v_event in select value from jsonb_array_elements(p_events)
  loop
    if jsonb_typeof(v_event) <> 'object' then raise exception 'INVALID_EVENT'; end if;
    if exists (select 1 from jsonb_object_keys(v_event) key where key not in ('clientEventId','eventName','occurredAt','anonymousId','appSessionId','captureFlowId','analysisSessionId','properties')) then raise exception 'INVALID_EVENT_KEY'; end if;
    v_event_id := (v_event->>'clientEventId')::uuid;
    v_anonymous_id := (v_event->>'anonymousId')::uuid;
    v_analysis_id := nullif(v_event->>'analysisSessionId', '')::uuid;
    if (v_event->>'eventName') not in ('app_session_started','onboarding_screen_viewed','onboarding_cta_pressed','onboarding_demo_tab_opened','paywall_viewed','purchase_started','purchase_succeeded','purchase_cancelled','purchase_failed','purchase_restored','subscription_management_opened','analysis_reservation_denied','analysis_cancelled','exercise_selected','recording_started','recording_completed','recording_failed','upload_started','analysis_result_viewed','feedback_prompt_viewed','coaching_section_viewed','record_another_set_clicked','reanalysis_started') then raise exception 'INVALID_EVENT_NAME'; end if;
    if jsonb_typeof(coalesce(v_event->'properties', '{}'::jsonb)) <> 'object' then raise exception 'INVALID_PROPERTIES'; end if;

    if v_analysis_id is not null and (p_user_id is null or not exists (select 1 from public.analysis_sessions where id = v_analysis_id and user_id = p_user_id)) then raise exception 'INVALID_ANALYSIS_OWNERSHIP'; end if;
    if p_user_id is not null then
      select user_id into v_existing_user from public.analytics_identity_links where anonymous_id = v_anonymous_id;
      if v_existing_user is not null and v_existing_user <> p_user_id then raise exception 'ANONYMOUS_ID_CONFLICT'; end if;
      insert into public.analytics_identity_links(anonymous_id, user_id) values (v_anonymous_id, p_user_id) on conflict (anonymous_id) do nothing;
      update public.product_analytics_events set user_id = p_user_id where anonymous_id = v_anonymous_id and user_id is null;
    end if;

    insert into public.analytics_ingestion_limits(bucket_kind, bucket_key, bucket_start, event_count)
    values ('anonymous_day', v_anonymous_id::text, date_trunc('day', now()), 1)
    on conflict (bucket_kind, bucket_key, bucket_start) do update set event_count = public.analytics_ingestion_limits.event_count + 1, updated_at = now()
    returning event_count into v_ip_total;
    if v_ip_total > 500 then raise exception 'RATE_LIMIT_ANONYMOUS'; end if;

    begin v_occurred_at := (v_event->>'occurredAt')::timestamptz; exception when others then v_occurred_at := now(); end;
    if v_occurred_at < now() - interval '7 days' or v_occurred_at > now() + interval '5 minutes' then v_occurred_at := now(); end if;

    insert into public.product_analytics_events(client_event_id, user_id, anonymous_id, app_session_id, capture_flow_id, analysis_session_id, event_name, properties, occurred_at, app_version, build_number, platform, received_at)
    values (v_event_id, p_user_id, v_anonymous_id, (v_event->>'appSessionId')::uuid, nullif(v_event->>'captureFlowId','')::uuid, v_analysis_id, v_event->>'eventName', coalesce(v_event->'properties','{}'::jsonb), v_occurred_at, v_event#>>'{properties,appVersion}', v_event#>>'{properties,buildNumber}', v_event#>>'{properties,platform}', now())
    on conflict (client_event_id) where client_event_id is not null do nothing;
    v_accepted := v_accepted || to_jsonb(v_event_id::text);
  end loop;
  return v_accepted;
end;
$$;

create or replace function public.cleanup_product_analytics_v2()
returns void language sql security definer set search_path = '' as $$
  delete from public.analytics_ingestion_limits where updated_at < now() - interval '2 days';
  delete from public.product_analytics_events event
  where event.user_id is null and event.anonymous_id is not null and event.received_at < now() - interval '30 days'
    and not exists (select 1 from public.analytics_identity_links link where link.anonymous_id = event.anonymous_id);
$$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cleanup-product-analytics-v2';
    perform cron.schedule('cleanup-product-analytics-v2', '17 4 * * *', 'select public.cleanup_product_analytics_v2()');
  end if;
end $$;

revoke all on public.product_analytics_events, public.analytics_identity_links, public.analytics_ingestion_limits from anon, authenticated;
revoke all on function public.ingest_product_analytics_v2(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_product_analytics_v2(uuid, text, jsonb) to service_role;
revoke all on function public.cleanup_product_analytics_v2() from public, anon, authenticated;
grant execute on function public.cleanup_product_analytics_v2() to service_role;
