-- Durable anonymous analytics ownership and immutable onboarding reporting.
alter table public.product_analytics_events drop constraint if exists product_analytics_events_event_name_check;
alter table public.product_analytics_events add constraint product_analytics_events_event_name_check check (event_name in (
  'app_session_started','onboarding_screen_viewed','onboarding_cta_pressed','onboarding_demo_tab_opened','onboarding_questionnaire_completed','account_created',
  'paywall_viewed','purchase_started','purchase_succeeded','purchase_cancelled','purchase_failed','purchase_restored','subscription_management_intent','subscription_management_opened',
  'analysis_reservation_denied','analysis_cancelled','exercise_selected','recording_started','recording_completed','recording_failed','upload_started',
  'upload_completed','upload_failed','analysis_result_viewed','feedback_prompt_viewed','coaching_section_viewed','record_another_set_clicked','reanalysis_started'
));

create table if not exists public.analytics_installations (
  anonymous_id uuid primary key,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  linked_user_id uuid references auth.users(id) on delete cascade,
  registered_at timestamptz not null default now(),
  linked_at timestamptz,
  rotated_at timestamptz
);

create table if not exists public.onboarding_reporting_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_version text not null,
  completed_at timestamptz not null,
  age_range text not null check (age_range in ('18-24','25-34','35-44','45-54','55+','unknown')),
  gender text not null,
  experience text not null,
  primary_goal text not null,
  biggest_frustration text not null,
  workouts_per_week integer,
  milestone_theme text not null check (milestone_theme in ('strength','technique','consistency','body_composition','confidence','other')),
  self_reported_source text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reporting_coverage (
  source_key text primary key,
  observed_since timestamptz not null,
  last_success_at timestamptz not null,
  status text not null check (status in ('healthy','delayed','incomplete','unavailable')),
  detail text not null,
  updated_at timestamptz not null default now()
);

alter table public.analytics_installations enable row level security;
alter table public.onboarding_reporting_snapshots enable row level security;
alter table public.reporting_coverage enable row level security;
revoke all on public.analytics_installations,public.onboarding_reporting_snapshots,public.reporting_coverage from public,anon,authenticated;
grant select,insert,update on public.analytics_installations,public.onboarding_reporting_snapshots,public.reporting_coverage to service_role;

create or replace function public.classify_milestone_theme(p_value text)
returns text language sql immutable set search_path='' as $$
  select case
    when lower(coalesce(p_value,'')) ~ '(strong|strength|weight|lift|bench|squat|deadlift)' then 'strength'
    when lower(coalesce(p_value,'')) ~ '(form|technique|movement|depth|range)' then 'technique'
    when lower(coalesce(p_value,'')) ~ '(consistent|routine|habit|regular)' then 'consistency'
    when lower(coalesce(p_value,'')) ~ '(lose|fat|lean|body|muscle|size|tone)' then 'body_composition'
    when lower(coalesce(p_value,'')) ~ '(confiden|comfortable|safe|fear)' then 'confidence'
    else 'other' end;
$$;

create or replace function public.redact_deleted_account_business_data(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_fingerprint text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  select account_fingerprint into v_fingerprint from public.subscription_transactions where user_id=p_user_id order by created_at limit 1;
  update public.revenuecat_webhook_events
    set app_user_id='deleted:'||coalesce(left(v_fingerprint,24),left(encode(public.digest(p_user_id::text,'sha256'),'hex'),24)),
        user_id=null,
        raw_event=case when raw_event is null then null else jsonb_build_object('redacted',true) end,
        last_error=null
    where user_id=p_user_id or app_user_id=p_user_id::text;
  update public.subscription_transactions set user_id=null where user_id=p_user_id;
  update public.subscription_reward_redemptions set user_id=null where user_id=p_user_id;
  delete from public.product_analytics_events where user_id=p_user_id;
end $$;

create or replace function public.record_my_onboarding_reporting_snapshot()
returns void language plpgsql security definer set search_path='' as $$
declare v_profile public.user_profiles%rowtype; v_source text;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  select * into v_profile from public.user_profiles where user_id=auth.uid();
  if not found or not v_profile.onboarding_completed then raise exception 'ONBOARDING_INCOMPLETE'; end if;
  select source into v_source from public.onboarding_acquisition_responses where user_id=auth.uid();
  insert into public.onboarding_reporting_snapshots(user_id,onboarding_version,completed_at,age_range,gender,experience,primary_goal,biggest_frustration,workouts_per_week,milestone_theme,self_reported_source)
  values(auth.uid(),coalesce(v_profile.onboarding_version,'unknown'),coalesce(v_profile.onboarding_completed_at,now()),
    case when v_profile.age_years is null then 'unknown' when v_profile.age_years<25 then '18-24' when v_profile.age_years<35 then '25-34' when v_profile.age_years<45 then '35-44' when v_profile.age_years<55 then '45-54' else '55+' end,
    coalesce(v_profile.gender,'unknown'),coalesce(v_profile.experience,'unknown'),coalesce(v_profile.primary_goal,'unknown'),coalesce(v_profile.biggest_frustration,'unknown'),v_profile.workouts_per_week,
    public.classify_milestone_theme(v_profile.custom_milestone),coalesce(v_source,'unknown'))
  on conflict(user_id) do nothing;
end $$;

create or replace function public.finalize_onboarding_with_referral(
  p_user_id uuid,
  p_profile jsonb,
  p_acquisition jsonb,
  p_token_hash text default null,
  p_method text default 'nativelink'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_profile public.user_profiles%rowtype;
  v_source text:=p_acquisition->>'source';
  v_other text:=nullif(btrim(p_acquisition->>'otherDetail'),'');
  v_platform text:=p_acquisition->>'platform';
  v_completed timestamptz:=now();
  v_claim record;
  v_referral jsonb:=jsonb_build_object('state','none');
begin
  if current_user not in ('postgres','service_role') or p_user_id is null then raise exception 'UNAUTHORIZED'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'USER_NOT_FOUND'; end if;
  if coalesce((p_profile->>'acceptedPrivacy')::boolean,false) is not true then raise exception 'PRIVACY_ACCEPTANCE_REQUIRED'; end if;
  if (p_profile->>'ageYears')::integer not between 18 and 100 then raise exception 'INVALID_AGE'; end if;
  if v_source not in ('tiktok','instagram','youtube','app_store_search','google_search','friend_trainer_coach','other') then raise exception 'INVALID_SOURCE'; end if;
  if v_platform not in ('ios','android','web','unknown') then raise exception 'INVALID_PLATFORM'; end if;
  if v_source='other' and (v_other is null or char_length(v_other)>80) then raise exception 'INVALID_OTHER_DETAIL'; end if;
  if v_source<>'other' then v_other:=null; end if;

  select * into v_profile from public.user_profiles where user_id=p_user_id for update;
  if not found or not v_profile.onboarding_completed then
    insert into public.user_profiles(
      user_id,display_name,experience,primary_goal,age_years,gender,height_cm,weight_kg,
      measurement_system,biggest_frustration,workouts_per_week,custom_milestone,onboarding_version,
      onboarding_step,onboarding_completed,legal_accepted_at,marketing_opt_in,onboarding_completed_at
    ) values(
      p_user_id,btrim(p_profile->>'displayName'),p_profile->>'experience',p_profile->>'primaryGoal',
      (p_profile->>'ageYears')::integer,p_profile->>'gender',(p_profile->>'heightCm')::numeric,
      (p_profile->>'weightKg')::numeric,p_profile->>'measurementSystem',p_profile->>'biggestFrustration',
      (p_profile->>'workoutsPerWeek')::integer,btrim(p_profile->>'customMilestone'),'approved-v1',
      'complete',true,v_completed,coalesce((p_profile->>'marketingOptIn')::boolean,false),v_completed
    ) on conflict(user_id) do update set
      display_name=excluded.display_name,experience=excluded.experience,primary_goal=excluded.primary_goal,
      age_years=excluded.age_years,gender=excluded.gender,height_cm=excluded.height_cm,weight_kg=excluded.weight_kg,
      measurement_system=excluded.measurement_system,biggest_frustration=excluded.biggest_frustration,
      workouts_per_week=excluded.workouts_per_week,custom_milestone=excluded.custom_milestone,
      onboarding_version='approved-v1',onboarding_step='complete',onboarding_completed=true,
      legal_accepted_at=coalesce(public.user_profiles.legal_accepted_at,excluded.legal_accepted_at),
      marketing_opt_in=excluded.marketing_opt_in,
      onboarding_completed_at=coalesce(public.user_profiles.onboarding_completed_at,excluded.onboarding_completed_at)
      where not public.user_profiles.onboarding_completed
    returning * into v_profile;
    if v_profile.user_id is null then select * into v_profile from public.user_profiles where user_id=p_user_id; end if;
  end if;

  insert into public.onboarding_acquisition_responses(user_id,source,other_detail,platform,onboarding_version)
  values(p_user_id,v_source,v_other,v_platform,'approved-v1') on conflict(user_id) do nothing;

  insert into public.onboarding_reporting_snapshots(user_id,onboarding_version,completed_at,age_range,gender,experience,primary_goal,biggest_frustration,workouts_per_week,milestone_theme,self_reported_source)
  values(p_user_id,coalesce(v_profile.onboarding_version,'approved-v1'),coalesce(v_profile.onboarding_completed_at,v_completed),
    case when v_profile.age_years is null then 'unknown' when v_profile.age_years<25 then '18-24' when v_profile.age_years<35 then '25-34' when v_profile.age_years<45 then '35-44' when v_profile.age_years<55 then '45-54' else '55+' end,
    coalesce(v_profile.gender,'unknown'),coalesce(v_profile.experience,'unknown'),coalesce(v_profile.primary_goal,'unknown'),coalesce(v_profile.biggest_frustration,'unknown'),v_profile.workouts_per_week,
    public.classify_milestone_theme(v_profile.custom_milestone),v_source) on conflict(user_id) do nothing;

  if p_token_hash is not null then
    begin
      select * into v_claim from public.claim_referral_visit(p_token_hash,p_user_id,p_method);
      if found then v_referral:=jsonb_build_object('state','attributed','creatorDisplayName',v_claim.creator_display_name,'attributedAt',v_claim.attributed_at,'alreadyClaimed',v_claim.already_claimed); end if;
    exception when others then
      v_referral:=jsonb_build_object('state','unavailable','code',sqlerrm);
    end;
  end if;

  return jsonb_build_object('profile',to_jsonb(v_profile),'referral',v_referral);
end $$;

create or replace function public.ingest_product_analytics_v3(
  p_user_id uuid,p_ip_hash text,p_anonymous_id uuid,p_installation_secret_hash text,p_events jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_install public.analytics_installations%rowtype; v_event jsonb; v_event_id uuid; v_name text; v_occurred timestamptz; v_accepted jsonb:='[]'::jsonb; v_count integer; v_rate_count integer; v_analysis_id uuid;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_ip_hash !~ '^[0-9a-f]{64}$' or p_installation_secret_hash !~ '^[0-9a-f]{64}$' or p_anonymous_id is null then raise exception 'INVALID_ANALYTICS_IDENTITY'; end if;
  if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events) not between 1 and 25 then raise exception 'INVALID_BATCH_SIZE'; end if;
  v_count:=jsonb_array_length(p_events);
  insert into public.analytics_ingestion_limits(bucket_kind,bucket_key,bucket_start,event_count)
  values('ip_hour',p_ip_hash,date_trunc('hour',now()),v_count)
  on conflict(bucket_kind,bucket_key,bucket_start) do update set event_count=public.analytics_ingestion_limits.event_count+excluded.event_count,updated_at=now()
  returning event_count into v_rate_count;
  if v_rate_count>300 then raise exception 'RATE_LIMIT_IP'; end if;
  insert into public.analytics_ingestion_limits(bucket_kind,bucket_key,bucket_start,event_count)
  values('anonymous_day',p_anonymous_id::text,date_trunc('day',now()),v_count)
  on conflict(bucket_kind,bucket_key,bucket_start) do update set event_count=public.analytics_ingestion_limits.event_count+excluded.event_count,updated_at=now()
  returning event_count into v_rate_count;
  if v_rate_count>500 then raise exception 'RATE_LIMIT_ANONYMOUS'; end if;
  perform pg_advisory_xact_lock(hashtext(p_anonymous_id::text));
  select * into v_install from public.analytics_installations where anonymous_id=p_anonymous_id for update;
  if not found then
    insert into public.analytics_installations(anonymous_id,secret_hash,linked_user_id,linked_at)
    values(p_anonymous_id,p_installation_secret_hash,p_user_id,case when p_user_id is null then null else now() end);
  elsif v_install.secret_hash<>p_installation_secret_hash then raise exception 'ANALYTICS_IDENTITY_MISMATCH';
  elsif p_user_id is not null and v_install.linked_user_id is not null and v_install.linked_user_id<>p_user_id then raise exception 'ANALYTICS_ACCOUNT_CONFLICT';
  elsif p_user_id is not null and v_install.linked_user_id is null then
    update public.analytics_installations set linked_user_id=p_user_id,linked_at=now() where anonymous_id=p_anonymous_id;
  end if;
  if p_user_id is not null then
    update public.product_analytics_events set user_id=p_user_id where anonymous_id=p_anonymous_id and user_id is null;
  end if;
  for v_event in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(v_event)<>'object' or exists(select 1 from jsonb_object_keys(v_event) key where key not in ('clientEventId','eventName','occurredAt','appSessionId','captureFlowId','analysisSessionId','properties')) then raise exception 'INVALID_EVENT'; end if;
    v_event_id:=(v_event->>'clientEventId')::uuid; v_name:=v_event->>'eventName';
    if v_name not in ('app_session_started','onboarding_screen_viewed','onboarding_cta_pressed','onboarding_demo_tab_opened','onboarding_questionnaire_completed','account_created','paywall_viewed','purchase_started','purchase_succeeded','purchase_cancelled','purchase_failed','purchase_restored','subscription_management_intent','subscription_management_opened','analysis_reservation_denied','analysis_cancelled','exercise_selected','recording_started','recording_completed','recording_failed','upload_started','upload_completed','upload_failed','analysis_result_viewed','feedback_prompt_viewed','coaching_section_viewed','record_another_set_clicked','reanalysis_started') then raise exception 'INVALID_EVENT_NAME'; end if;
    if jsonb_typeof(coalesce(v_event->'properties','{}'::jsonb))<>'object' then raise exception 'INVALID_PROPERTIES'; end if;
    if exists(select 1 from jsonb_object_keys(coalesce(v_event->'properties','{}'::jsonb)) key where key not in ('screenId','step','onboardingVersion','tab','offerId','errorCategory','platform','appVersion','buildNumber','exerciseId','outcome','durationMs','reason','source')) then raise exception 'INVALID_PROPERTY'; end if;
    if v_name like 'onboarding_%' and exists(select 1 from jsonb_object_keys(coalesce(v_event->'properties','{}'::jsonb)) key where key not in ('screenId','step','onboardingVersion','tab','platform','appVersion','buildNumber')) then raise exception 'INVALID_ONBOARDING_PROPERTY'; end if;
    if v_name in ('paywall_viewed','purchase_started','purchase_succeeded','purchase_cancelled','purchase_failed','purchase_restored','subscription_management_intent','subscription_management_opened') and exists(select 1 from jsonb_object_keys(coalesce(v_event->'properties','{}'::jsonb)) key where key not in ('offerId','errorCategory','platform','appVersion','buildNumber','outcome','source')) then raise exception 'INVALID_BILLING_PROPERTY'; end if;
    if v_name in ('exercise_selected','recording_started','recording_completed','recording_failed','upload_started','upload_completed','upload_failed','analysis_reservation_denied','analysis_cancelled') and exists(select 1 from jsonb_object_keys(coalesce(v_event->'properties','{}'::jsonb)) key where key not in ('exerciseId','errorCategory','durationMs','outcome','reason','source','platform','appVersion','buildNumber')) then raise exception 'INVALID_CAPTURE_PROPERTY'; end if;
    v_analysis_id:=nullif(v_event->>'analysisSessionId','')::uuid;
    if v_analysis_id is not null and (p_user_id is null or not exists(select 1 from public.analysis_sessions session where session.id=v_analysis_id and session.user_id=p_user_id)) then raise exception 'INVALID_ANALYSIS_OWNERSHIP'; end if;
    begin v_occurred:=(v_event->>'occurredAt')::timestamptz; exception when others then v_occurred:=now(); end;
    if v_occurred<now()-interval '7 days' or v_occurred>now()+interval '5 minutes' then v_occurred:=now(); end if;
    insert into public.product_analytics_events(client_event_id,user_id,anonymous_id,app_session_id,capture_flow_id,analysis_session_id,event_name,properties,occurred_at,app_version,build_number,platform,received_at)
    values(v_event_id,p_user_id,p_anonymous_id,nullif(v_event->>'appSessionId','')::uuid,nullif(v_event->>'captureFlowId','')::uuid,v_analysis_id,v_name,coalesce(v_event->'properties','{}'::jsonb),v_occurred,v_event#>>'{properties,appVersion}',v_event#>>'{properties,buildNumber}',v_event#>>'{properties,platform}',now())
    on conflict(client_event_id) where client_event_id is not null do nothing;
    v_accepted:=v_accepted||to_jsonb(v_event_id::text);
  end loop;
  insert into public.reporting_coverage(source_key,observed_since,last_success_at,status,detail)
  values('product_analytics_v3',now(),now(),'healthy','Durable mobile analytics batches')
  on conflict(source_key) do update set last_success_at=now(),status='healthy',updated_at=now();
  return v_accepted;
end $$;

revoke all on function public.record_my_onboarding_reporting_snapshot() from public,anon;
grant execute on function public.record_my_onboarding_reporting_snapshot() to authenticated;
revoke all on function public.finalize_onboarding_with_referral(uuid,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.finalize_onboarding_with_referral(uuid,jsonb,jsonb,text,text) to service_role;
revoke all on function public.ingest_product_analytics_v3(uuid,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_product_analytics_v3(uuid,text,uuid,text,jsonb) to service_role;
revoke all on function public.redact_deleted_account_business_data(uuid) from public,anon,authenticated;
grant execute on function public.redact_deleted_account_business_data(uuid) to service_role;
