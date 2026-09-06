-- Replace third-party deferred deep links with first-party creator codes.
-- The existing creator_links.public_slug is the permanent, case-insensitive
-- public code. Validation issues a short-lived bearer claim; signup and all
-- rewards continue to use the immutable referral/account ledgers.

alter table public.account_referrals
  drop constraint if exists account_referrals_attribution_method_check;
alter table public.account_referrals
  add constraint account_referrals_attribution_method_check
  check (attribution_method in ('direct_link','nativelink','creator_code'));

alter table public.onboarding_acquisition_responses
  drop constraint if exists onboarding_acquisition_responses_source_check;
alter table public.onboarding_acquisition_responses
  add constraint onboarding_acquisition_responses_source_check
  check (source in ('tiktok','instagram','youtube','app_store_search','google_search','friend_trainer_coach','affiliated_creator','other'));

alter table public.creator_auth_rate_limits
  drop constraint if exists creator_auth_rate_limits_action_check;
alter table public.creator_auth_rate_limits
  add constraint creator_auth_rate_limits_action_check
  check (action in ('login','recovery','code_validation'));

create or replace function public.consume_creator_auth_rate_limit(
  p_key_hash text,p_action text,p_window_seconds integer default 900,p_max_attempts integer default 8
) returns boolean language plpgsql security definer set search_path=''
as $$
declare v_window timestamptz; v_attempts integer;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' or p_action not in ('login','recovery','code_validation') or p_window_seconds<60 or p_window_seconds>86400 or p_max_attempts<1 or p_max_attempts>100 then raise exception 'INVALID_RATE_LIMIT'; end if;
  v_window:=to_timestamp(floor(extract(epoch from now())/p_window_seconds)*p_window_seconds);
  insert into public.creator_auth_rate_limits(key_hash,action,window_started_at,attempts) values(p_key_hash,p_action,v_window,1)
  on conflict(key_hash,action,window_started_at) do update set attempts=public.creator_auth_rate_limits.attempts+1
  returning attempts into v_attempts;
  delete from public.creator_auth_rate_limits where window_started_at<now()-interval '2 days';
  return v_attempts<=p_max_attempts;
end $$;

create or replace function public.issue_creator_code_visit(
  p_code text,
  p_token_hash text,
  p_environment text
) returns table(
  visit_id uuid,
  creator_display_name text,
  issued_at timestamptz,
  expires_at timestamptz,
  eligible boolean
) language plpgsql security definer set search_path=''
as $$
declare
  v_link public.creator_links%rowtype;
  v_creator public.creators%rowtype;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if not exists(select 1 from public.referral_program_settings settings where settings.singleton and settings.issuance_enabled) then
    raise exception 'REFERRAL_ISSUANCE_DISABLED';
  end if;
  if p_environment not in ('production','sandbox') then raise exception 'INVALID_ENVIRONMENT'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_TOKEN_HASH'; end if;
  if lower(btrim(coalesce(p_code,''))) !~ '^[a-z0-9][a-z0-9-]{2,31}$' then raise exception 'INVALID_CREATOR_CODE'; end if;

  select link.* into v_link
  from public.creator_links link
  where link.public_slug=lower(btrim(p_code)) and link.status='active';
  if not found then return; end if;

  select creator.* into v_creator
  from public.creators creator
  where creator.id=v_link.creator_id and creator.status='active';
  if not found then return; end if;

  insert into public.referral_visits(creator_link_id,token_hash,environment,expires_at,recovered_at)
  values(v_link.id,p_token_hash,p_environment,now()+interval '30 days',now())
  returning referral_visits.id,referral_visits.issued_at,referral_visits.expires_at
  into visit_id,issued_at,expires_at;

  creator_display_name:=v_creator.display_name;
  eligible:=true;
  return next;
end $$;

create or replace function public.claim_referral_visit(p_token_hash text,p_user_id uuid,p_method text)
returns table(creator_id uuid,creator_display_name text,attributed_at timestamptz,already_claimed boolean)
language plpgsql security definer set search_path=''
as $$
declare
  v_visit public.referral_visits%rowtype;
  v_link public.creator_links%rowtype;
  v_creator public.creators%rowtype;
  v_rate uuid;
  v_created timestamptz;
  v_existing public.account_referrals%rowtype;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_method not in ('direct_link','nativelink','creator_code') then raise exception 'INVALID_ATTRIBUTION_METHOD'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select referral.* into v_existing from public.account_referrals referral where referral.user_id=p_user_id;
  if found then
    select creator.display_name into creator_display_name from public.creators creator where creator.id=v_existing.creator_id;
    creator_id:=v_existing.creator_id;
    attributed_at:=v_existing.attributed_at;
    already_claimed:=true;
    return next;
    return;
  end if;
  select auth_user.created_at into v_created from auth.users auth_user where auth_user.id=p_user_id;
  if v_created is null or v_created<now()-interval '24 hours' then raise exception 'REFERRAL_ACCOUNT_INELIGIBLE'; end if;
  select visit.* into v_visit from public.referral_visits visit where visit.token_hash=p_token_hash for update;
  if not found or v_visit.excluded_reason is not null or v_visit.expires_at<=now() then raise exception 'REFERRAL_INVALID_OR_EXPIRED'; end if;
  if v_visit.issued_at>v_created then raise exception 'REFERRAL_AFTER_ACCOUNT_CREATION'; end if;
  if v_visit.claimed_user_id is not null and v_visit.claimed_user_id<>p_user_id then raise exception 'REFERRAL_ALREADY_CLAIMED'; end if;
  select link.* into v_link from public.creator_links link where link.id=v_visit.creator_link_id;
  select creator.* into v_creator from public.creators creator where creator.id=v_link.creator_id;
  select rate.id into v_rate
  from public.creator_rate_versions rate
  where rate.creator_id=v_creator.id
    and rate.effective_from<=v_visit.issued_at
    and (rate.effective_to is null or rate.effective_to>v_visit.issued_at)
  order by rate.effective_from desc limit 1;
  if v_rate is null then raise exception 'REFERRAL_RATE_UNAVAILABLE'; end if;
  insert into public.account_referrals(
    user_id,creator_id,creator_link_id,referral_visit_id,rate_version_id,environment,attribution_method,reward_eligible
  ) values(
    p_user_id,v_creator.id,v_link.id,v_visit.id,v_rate,v_visit.environment,p_method,
    coalesce((select settings.rewards_enabled from public.referral_program_settings settings where settings.singleton),false)
  ) returning account_referrals.attributed_at into attributed_at;
  update public.referral_visits visit
  set recovered_at=coalesce(visit.recovered_at,now()),claimed_at=now(),claimed_user_id=p_user_id
  where visit.id=v_visit.id;
  creator_id:=v_creator.id;
  creator_display_name:=v_creator.display_name;
  already_claimed:=false;
  return next;
end $$;

create or replace function public.record_onboarding_acquisition(
  p_source text,p_other_detail text,p_platform text,p_onboarding_version text
) returns uuid language plpgsql security definer set search_path=public
as $$
declare
  v_user_id uuid:=auth.uid();
  v_response_id uuid;
  v_other_detail text:=nullif(btrim(p_other_detail),'');
begin
  if v_user_id is null then raise exception 'UNAUTHORIZED'; end if;
  if p_source not in ('tiktok','instagram','youtube','app_store_search','google_search','friend_trainer_coach','affiliated_creator','other') then raise exception 'INVALID_SOURCE'; end if;
  if p_platform not in ('ios','android','web','unknown') then raise exception 'INVALID_PLATFORM'; end if;
  if p_source='other' and (v_other_detail is null or char_length(v_other_detail)>80) then raise exception 'INVALID_OTHER_DETAIL'; end if;
  if p_source<>'other' then v_other_detail:=null; end if;
  if nullif(btrim(p_onboarding_version),'') is null then raise exception 'INVALID_ONBOARDING_VERSION'; end if;
  insert into public.onboarding_acquisition_responses(user_id,source,other_detail,platform,onboarding_version)
  values(v_user_id,p_source,v_other_detail,p_platform,btrim(p_onboarding_version))
  on conflict(user_id) do nothing returning id into v_response_id;
  if v_response_id is null then select response.id into v_response_id from public.onboarding_acquisition_responses response where response.user_id=v_user_id; end if;
  return v_response_id;
end $$;

create or replace function public.finalize_onboarding_with_referral(
  p_user_id uuid,p_profile jsonb,p_acquisition jsonb,p_token_hash text default null,p_method text default 'creator_code'
) returns jsonb language plpgsql security definer set search_path=''
as $$
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
  if v_source not in ('tiktok','instagram','youtube','app_store_search','google_search','friend_trainer_coach','affiliated_creator','other') then raise exception 'INVALID_SOURCE'; end if;
  if v_platform not in ('ios','android','web','unknown') then raise exception 'INVALID_PLATFORM'; end if;
  if v_source='other' and (v_other is null or char_length(v_other)>80) then raise exception 'INVALID_OTHER_DETAIL'; end if;
  if v_source<>'other' then v_other:=null; end if;
  if v_source='affiliated_creator' and (p_token_hash is null or p_method<>'creator_code') then raise exception 'CREATOR_CODE_REQUIRED'; end if;

  select profile.* into v_profile from public.user_profiles profile where profile.user_id=p_user_id for update;
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
    if v_profile.user_id is null then select profile.* into v_profile from public.user_profiles profile where profile.user_id=p_user_id; end if;
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

create or replace function public.get_creator_dashboard_v3(
  p_window text default '30d',p_limit integer default 50,p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_result jsonb;
  v_code text;
begin
  v_result:=public.get_creator_dashboard_v2(p_window,p_limit,p_offset);
  v_code:=upper(split_part(v_result#>>'{creator,referralUrl}','/r/',2));
  v_result:=v_result#-'{creator,referralUrl}';
  v_result:=jsonb_set(v_result,'{creator,creatorCode}',to_jsonb(v_code),true);
  v_result:=jsonb_set(v_result,'{metrics,visits,definition}',to_jsonb('Successful creator-code validations in the selected window'::text),false);
  v_result:=jsonb_set(v_result,'{metrics,recovered,definition}',to_jsonb('Validated creator-code claims ready to attach during new-account finalization'::text),false);
  return v_result;
end $$;

revoke all on function public.issue_creator_code_visit(text,text,text) from public,anon,authenticated;
grant execute on function public.issue_creator_code_visit(text,text,text) to service_role;
revoke all on function public.consume_creator_auth_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_creator_auth_rate_limit(text,text,integer,integer) to service_role;
revoke all on function public.claim_referral_visit(text,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_referral_visit(text,uuid,text) to service_role;
revoke all on function public.record_onboarding_acquisition(text,text,text,text) from public,anon;
grant execute on function public.record_onboarding_acquisition(text,text,text,text) to authenticated;
revoke all on function public.finalize_onboarding_with_referral(uuid,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.finalize_onboarding_with_referral(uuid,jsonb,jsonb,text,text) to service_role;
revoke all on function public.get_creator_dashboard_v3(text,integer,integer) from public,anon;
grant execute on function public.get_creator_dashboard_v3(text,integer,integer) to authenticated;
