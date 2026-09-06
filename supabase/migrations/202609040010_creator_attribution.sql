-- Link-only creator referrals. Raw referral tokens are never persisted.
create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creator_memberships_creator_idx on public.creator_memberships(creator_id) where status='active';

create table if not exists public.creator_rate_versions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  commission_basis_points integer not null check (commission_basis_points between 0 and 2000),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);
create unique index if not exists creator_rate_one_open_idx on public.creator_rate_versions(creator_id) where effective_to is null;
create index if not exists creator_rate_lookup_idx on public.creator_rate_versions(creator_id,effective_from desc);

create table if not exists public.creator_links (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  public_slug text not null unique check (public_slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists creator_one_link_idx on public.creator_links(creator_id);

create table if not exists public.referral_visits (
  id uuid primary key default gen_random_uuid(),
  creator_link_id uuid not null references public.creator_links(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  environment text not null check (environment in ('production','sandbox')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  recovered_at timestamptz,
  claimed_at timestamptz,
  claimed_user_id uuid references auth.users(id) on delete set null,
  excluded_reason text,
  check (expires_at > issued_at),
  -- Account deletion removes the user identifier while retaining the
  -- non-personal fact that this visit was claimed for aggregate accounting.
  check ((claimed_at is null and claimed_user_id is null) or claimed_at is not null)
);
create index if not exists referral_visits_link_time_idx on public.referral_visits(creator_link_id,issued_at desc);
create index if not exists referral_visits_unmatched_idx on public.referral_visits(expires_at) where claimed_at is null and excluded_reason is null;

create table if not exists public.creator_referral_exclusions (
  id bigint generated always as identity primary key,
  creator_link_id uuid not null references public.creator_links(id) on delete restrict,
  reason text not null check(reason in ('prefetch','preview_bot')),
  excluded_at timestamptz not null default now()
);
create index if not exists creator_referral_exclusions_link_time_idx on public.creator_referral_exclusions(creator_link_id,excluded_at desc);

create table if not exists public.account_referrals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete restrict,
  creator_link_id uuid not null references public.creator_links(id) on delete restrict,
  referral_visit_id uuid not null unique references public.referral_visits(id) on delete restrict,
  rate_version_id uuid not null references public.creator_rate_versions(id) on delete restrict,
  environment text not null check(environment in ('production','sandbox')),
  attributed_at timestamptz not null default now(),
  attribution_method text not null check (attribution_method in ('direct_link','nativelink'))
);
create index if not exists account_referrals_creator_idx on public.account_referrals(creator_id,attributed_at desc);

create table if not exists public.founder_action_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now()
);

create table if not exists public.creator_auth_rate_limits (
  key_hash text not null check(length(key_hash)=64),
  action text not null check(action in ('login','recovery')),
  window_started_at timestamptz not null,
  attempts integer not null check(attempts>0),
  primary key(key_hash,action,window_started_at)
);

alter table public.creators enable row level security;
alter table public.creator_memberships enable row level security;
alter table public.creator_rate_versions enable row level security;
alter table public.creator_links enable row level security;
alter table public.referral_visits enable row level security;
alter table public.creator_referral_exclusions enable row level security;
alter table public.account_referrals enable row level security;
alter table public.founder_action_audit enable row level security;
alter table public.creator_auth_rate_limits enable row level security;

revoke all on public.creators,public.creator_memberships,public.creator_rate_versions,public.creator_links,public.referral_visits,public.creator_referral_exclusions,public.account_referrals,public.founder_action_audit,public.creator_auth_rate_limits from public,anon,authenticated;
grant select,insert,update on public.creators,public.creator_memberships,public.creator_rate_versions,public.creator_links,public.referral_visits,public.creator_referral_exclusions,public.account_referrals,public.founder_action_audit,public.creator_auth_rate_limits to service_role;
grant delete on public.creator_auth_rate_limits to service_role;

create or replace function public.consume_creator_auth_rate_limit(p_key_hash text,p_action text,p_window_seconds integer default 900,p_max_attempts integer default 8)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_window timestamptz; v_attempts integer;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' or p_action not in ('login','recovery') or p_window_seconds<60 or p_window_seconds>86400 or p_max_attempts<1 or p_max_attempts>100 then raise exception 'INVALID_RATE_LIMIT'; end if;
  v_window:=to_timestamp(floor(extract(epoch from now())/p_window_seconds)*p_window_seconds);
  insert into public.creator_auth_rate_limits(key_hash,action,window_started_at,attempts) values(p_key_hash,p_action,v_window,1)
  on conflict(key_hash,action,window_started_at) do update set attempts=public.creator_auth_rate_limits.attempts+1
  returning attempts into v_attempts;
  delete from public.creator_auth_rate_limits where window_started_at<now()-interval '2 days';
  return v_attempts<=p_max_attempts;
end $$;

create or replace function public.issue_creator_referral_visit(
  p_slug text,p_token_hash text,p_environment text,p_expires_at timestamptz
) returns table(visit_id uuid,creator_display_name text,issued_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_link public.creator_links%rowtype; v_creator public.creators%rowtype;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_environment not in ('production','sandbox') or p_expires_at<=now() or p_expires_at>now()+interval '30 days 5 minutes' then raise exception 'INVALID_VISIT'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_TOKEN_HASH'; end if;
  select * into v_link from public.creator_links where public_slug=lower(btrim(p_slug)) and status='active';
  if not found then return; end if;
  select * into v_creator from public.creators where id=v_link.creator_id and status='active';
  if not found then return; end if;
  insert into public.referral_visits(creator_link_id,token_hash,environment,expires_at)
  values(v_link.id,p_token_hash,p_environment,p_expires_at)
  returning id,public.referral_visits.issued_at,public.referral_visits.expires_at into visit_id,issued_at,expires_at;
  creator_display_name:=v_creator.display_name;
  return next;
end $$;

create or replace function public.record_creator_referral_exclusion(p_slug text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_reason not in ('prefetch','preview_bot') then raise exception 'INVALID_EXCLUSION'; end if;
  insert into public.creator_referral_exclusions(creator_link_id,reason)
  select id,p_reason from public.creator_links where public_slug=lower(btrim(p_slug));
end $$;

create or replace function public.preview_referral_visit(p_token_hash text)
returns table(visit_id uuid,creator_display_name text,issued_at timestamptz,expires_at timestamptz,eligible boolean)
language plpgsql security definer set search_path='' as $$
declare v_visit public.referral_visits%rowtype; v_name text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  select visit.* into v_visit from public.referral_visits visit where visit.token_hash=p_token_hash;
  if not found then return; end if;
  select creator.display_name into v_name
  from public.creator_links link join public.creators creator on creator.id=link.creator_id
  where link.id=v_visit.creator_link_id;
  update public.referral_visits set recovered_at=coalesce(recovered_at,now()) where id=v_visit.id;
  return query select v_visit.id,v_name,v_visit.issued_at,v_visit.expires_at,
    (v_visit.excluded_reason is null and v_visit.claimed_at is null and v_visit.expires_at>now());
end $$;

create or replace function public.claim_referral_visit(p_token_hash text,p_user_id uuid,p_method text)
returns table(creator_id uuid,creator_display_name text,attributed_at timestamptz,already_claimed boolean)
language plpgsql security definer set search_path='' as $$
declare v_visit public.referral_visits%rowtype; v_link public.creator_links%rowtype; v_creator public.creators%rowtype; v_rate uuid; v_created timestamptz; v_existing public.account_referrals%rowtype;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_method not in ('direct_link','nativelink') then raise exception 'INVALID_ATTRIBUTION_METHOD'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select * into v_existing from public.account_referrals where user_id=p_user_id;
  if found then
    select display_name into creator_display_name from public.creators where id=v_existing.creator_id;
    creator_id:=v_existing.creator_id; attributed_at:=v_existing.attributed_at; already_claimed:=true; return next; return;
  end if;
  select created_at into v_created from auth.users where id=p_user_id;
  if v_created is null or v_created<now()-interval '24 hours' then raise exception 'REFERRAL_ACCOUNT_INELIGIBLE'; end if;
  select * into v_visit from public.referral_visits where token_hash=p_token_hash for update;
  if not found or v_visit.excluded_reason is not null or v_visit.expires_at<=now() then raise exception 'REFERRAL_INVALID_OR_EXPIRED'; end if;
  if v_visit.issued_at>v_created then raise exception 'REFERRAL_AFTER_ACCOUNT_CREATION'; end if;
  if v_visit.claimed_user_id is not null and v_visit.claimed_user_id<>p_user_id then raise exception 'REFERRAL_ALREADY_CLAIMED'; end if;
  select * into v_link from public.creator_links where id=v_visit.creator_link_id;
  select * into v_creator from public.creators where id=v_link.creator_id;
  select id into v_rate from public.creator_rate_versions where creator_id=v_creator.id and effective_from<=v_visit.issued_at and (effective_to is null or effective_to>v_visit.issued_at) order by effective_from desc limit 1;
  if v_rate is null then raise exception 'REFERRAL_RATE_UNAVAILABLE'; end if;
  insert into public.account_referrals(user_id,creator_id,creator_link_id,referral_visit_id,rate_version_id,environment,attribution_method)
  values(p_user_id,v_creator.id,v_link.id,v_visit.id,v_rate,v_visit.environment,p_method)
  returning account_referrals.attributed_at into attributed_at;
  update public.referral_visits set recovered_at=coalesce(recovered_at,now()),claimed_at=now(),claimed_user_id=p_user_id where id=v_visit.id;
  creator_id:=v_creator.id; creator_display_name:=v_creator.display_name; already_claimed:=false; return next;
end $$;

create or replace function public.get_my_referral_status()
returns table(state text,creator_display_name text,attributed_at timestamptz)
language sql security definer set search_path='' as $$
  select case when referral.user_id is null then 'none' else 'attributed' end,
    creator.display_name,referral.attributed_at
  from (select auth.uid() user_id) me
  left join public.account_referrals referral on referral.user_id=me.user_id
  left join public.creators creator on creator.id=referral.creator_id;
$$;

create or replace function public.get_my_creator_membership()
returns table(creator_id uuid,status text) language sql security definer set search_path='' as $$
  select membership.creator_id,membership.status from public.creator_memberships membership where membership.user_id=auth.uid() and membership.status='active';
$$;

create or replace function public.provision_creator(
  p_user_id uuid,p_display_name text,p_slug text,p_rate_basis_points integer,p_actor_user_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_creator uuid;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_rate_basis_points not between 0 and 2000 then raise exception 'INVALID_RATE'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'USER_NOT_FOUND'; end if;
  insert into public.creators(display_name) values(btrim(p_display_name)) returning id into v_creator;
  insert into public.creator_memberships(user_id,creator_id) values(p_user_id,v_creator);
  insert into public.creator_rate_versions(creator_id,commission_basis_points) values(v_creator,p_rate_basis_points);
  insert into public.creator_links(creator_id,public_slug) values(v_creator,lower(btrim(p_slug)));
  insert into public.founder_action_audit(actor_user_id,action,entity_type,entity_id,details)
  values(p_actor_user_id,'creator_provisioned','creator',v_creator::text,jsonb_build_object('rateBasisPoints',p_rate_basis_points,'slug',lower(btrim(p_slug))));
  return v_creator;
end $$;

create or replace function public.set_creator_link_state(p_creator_id uuid,p_status text,p_actor_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_status not in ('active','paused') then raise exception 'INVALID_STATUS'; end if;
  update public.creator_links set status=p_status,updated_at=now() where creator_id=p_creator_id;
  update public.creators set status=p_status,updated_at=now() where id=p_creator_id;
  if not found then raise exception 'CREATOR_NOT_FOUND'; end if;
  insert into public.founder_action_audit(actor_user_id,action,entity_type,entity_id,details) values(p_actor_user_id,'creator_link_state_changed','creator',p_creator_id::text,jsonb_build_object('status',p_status));
end $$;

create or replace function public.set_creator_future_rate(p_creator_id uuid,p_rate_basis_points integer,p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_rate uuid;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_rate_basis_points not between 0 and 2000 then raise exception 'INVALID_RATE'; end if;
  perform pg_advisory_xact_lock(hashtext(p_creator_id::text));
  update public.creator_rate_versions set effective_to=now() where creator_id=p_creator_id and effective_to is null;
  insert into public.creator_rate_versions(creator_id,commission_basis_points) values(p_creator_id,p_rate_basis_points) returning id into v_rate;
  insert into public.founder_action_audit(actor_user_id,action,entity_type,entity_id,details) values(p_actor_user_id,'creator_rate_changed','creator',p_creator_id::text,jsonb_build_object('rateBasisPoints',p_rate_basis_points));
  return v_rate;
end $$;

create or replace function public.set_creator_membership_state(
  p_creator_id uuid,p_user_id uuid,p_status text,p_actor_user_id uuid
) returns void language plpgsql security definer set search_path='' as $$
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_status not in ('active','revoked') then raise exception 'INVALID_STATUS'; end if;
  update public.creator_memberships
  set status=p_status,updated_at=now()
  where creator_id=p_creator_id and user_id=p_user_id;
  if not found then raise exception 'CREATOR_MEMBERSHIP_NOT_FOUND'; end if;
  insert into public.founder_action_audit(actor_user_id,action,entity_type,entity_id,details)
  values(p_actor_user_id,'creator_membership_state_changed','creator_membership',p_user_id::text,jsonb_build_object('creatorId',p_creator_id,'status',p_status));
end $$;

revoke all on function public.issue_creator_referral_visit(text,text,text,timestamptz),public.preview_referral_visit(text),public.claim_referral_visit(text,uuid,text) from public,anon,authenticated;
grant execute on function public.issue_creator_referral_visit(text,text,text,timestamptz),public.preview_referral_visit(text),public.claim_referral_visit(text,uuid,text) to service_role;
revoke all on function public.record_creator_referral_exclusion(text,text) from public,anon,authenticated;
grant execute on function public.record_creator_referral_exclusion(text,text) to service_role;
revoke all on function public.provision_creator(uuid,text,text,integer,uuid),public.set_creator_link_state(uuid,text,uuid),public.set_creator_future_rate(uuid,integer,uuid),public.set_creator_membership_state(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.provision_creator(uuid,text,text,integer,uuid),public.set_creator_link_state(uuid,text,uuid),public.set_creator_future_rate(uuid,integer,uuid),public.set_creator_membership_state(uuid,uuid,text,uuid) to service_role;
revoke all on function public.consume_creator_auth_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_creator_auth_rate_limit(text,text,integer,integer) to service_role;
revoke all on function public.get_my_referral_status() from public,anon;
grant execute on function public.get_my_referral_status() to authenticated;
revoke all on function public.get_my_creator_membership() from public,anon;
grant execute on function public.get_my_creator_membership() to authenticated;
