-- Keep visit issuance and reward eligibility independently controllable.
-- Reward eligibility is locked on attribution so a later rollout change does
-- not remove a valid existing account's promised first-payment reward.
create table if not exists public.referral_program_settings (
  singleton boolean primary key default true check(singleton),
  issuance_enabled boolean not null default false,
  rewards_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.referral_program_settings(singleton) values(true) on conflict(singleton) do nothing;
alter table public.referral_program_settings enable row level security;
revoke all on public.referral_program_settings from public,anon,authenticated;
grant select,update on public.referral_program_settings to service_role;

alter table public.account_referrals add column if not exists reward_eligible boolean not null default false;

create or replace function public.set_referral_program_settings(
  p_issuance_enabled boolean,p_rewards_enabled boolean,p_actor_user_id uuid
) returns void language plpgsql security definer set search_path='' as $$
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  update public.referral_program_settings set issuance_enabled=p_issuance_enabled,rewards_enabled=p_rewards_enabled,updated_at=now(),updated_by=p_actor_user_id where singleton;
  insert into public.founder_action_audit(actor_user_id,action,entity_type,entity_id,details)
  values(p_actor_user_id,'referral_program_settings_changed','referral_program','singleton',jsonb_build_object('issuanceEnabled',p_issuance_enabled,'rewardsEnabled',p_rewards_enabled));
end $$;

do $$
declare v_definition text; v_search text; v_replacement text;
begin
  select pg_get_functiondef('public.issue_creator_referral_visit(text,text,text,timestamptz)'::regprocedure) into v_definition;
  v_search:='if current_user not in (''postgres'',''service_role'') then raise exception ''UNAUTHORIZED''; end if;';
  v_replacement:=v_search||E'\n  if not exists(select 1 from public.referral_program_settings where singleton and issuance_enabled) then raise exception ''REFERRAL_ISSUANCE_DISABLED''; end if;';
  if strpos(v_definition,v_replacement)=0 then
    if strpos(v_definition,v_search)=0 then raise exception 'ISSUANCE_FUNCTION_DEFINITION_NOT_RECOGNIZED'; end if;
    execute replace(v_definition,v_search,v_replacement);
  end if;

  select pg_get_functiondef('public.claim_referral_visit(text,uuid,text)'::regprocedure) into v_definition;
  v_search:='insert into public.account_referrals(user_id,creator_id,creator_link_id,referral_visit_id,rate_version_id,environment,attribution_method)';
  v_replacement:='insert into public.account_referrals(user_id,creator_id,creator_link_id,referral_visit_id,rate_version_id,environment,attribution_method,reward_eligible)';
  if strpos(v_definition,v_replacement)=0 then
    if strpos(v_definition,v_search)=0 then raise exception 'CLAIM_COLUMNS_DEFINITION_NOT_RECOGNIZED'; end if;
    v_definition:=replace(v_definition,v_search,v_replacement);
    v_search:='values(p_user_id,v_creator.id,v_link.id,v_visit.id,v_rate,v_visit.environment,p_method)';
    v_replacement:='values(p_user_id,v_creator.id,v_link.id,v_visit.id,v_rate,v_visit.environment,p_method,coalesce((select rewards_enabled from public.referral_program_settings where singleton),false))';
    if strpos(v_definition,v_search)=0 then raise exception 'CLAIM_VALUES_DEFINITION_NOT_RECOGNIZED'; end if;
    execute replace(v_definition,v_search,v_replacement);
  end if;

  select pg_get_functiondef('public.project_revenuecat_transaction(text,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,numeric,text,text,numeric,numeric,timestamptz,timestamptz)'::regprocedure) into v_definition;
  v_search:='v_is_first:=p_gross is not null';
  v_replacement:='v_is_first:=v_referral.reward_eligible and p_gross is not null';
  if strpos(v_definition,v_replacement)=0 then
    if strpos(v_definition,v_search)=0 then raise exception 'REWARD_FUNCTION_DEFINITION_NOT_RECOGNIZED'; end if;
    execute replace(v_definition,v_search,v_replacement);
  end if;
end $$;

revoke all on function public.set_referral_program_settings(boolean,boolean,uuid) from public,anon,authenticated;
grant execute on function public.set_referral_program_settings(boolean,boolean,uuid) to service_role;
