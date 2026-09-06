-- Qualify every table column that can collide with a RETURNS TABLE output
-- variable. This also retains the reward-eligibility snapshot introduced by
-- the rollout-controls migration.
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
  if p_method not in ('direct_link','nativelink') then raise exception 'INVALID_ATTRIBUTION_METHOD'; end if;
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

revoke all on function public.claim_referral_visit(text,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_referral_visit(text,uuid,text) to service_role;
