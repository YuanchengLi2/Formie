begin;
do $$
declare
  customer uuid:=gen_random_uuid(); anonymous_user uuid:=gen_random_uuid();
  stale uuid:=gen_random_uuid(); recent uuid:=gen_random_uuid(); leased uuid:=gen_random_uuid();
  before_count bigint; after_count bigint; analysis_before bigint; analysis_after bigint;
begin
  select count(*) into before_count from public.business_customer_accounts;
  insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at)
  values(customer,'authenticated','authenticated',false,now(),now()),
        (anonymous_user,'authenticated','authenticated',true,now(),now());
  select count(*) into after_count from public.business_customer_accounts;
  if after_count<>before_count+1 then raise exception 'Anonymous identities entered customer reporting'; end if;
  select count(*) into analysis_before from public.business_analysis_activity;
  insert into public.analysis_sessions(user_id,status,completed_at,created_at,updated_at)
  values(customer,'complete',now(),now(),now());
  select count(*) into analysis_after from public.business_analysis_activity;
  if analysis_after<>analysis_before+1 then raise exception 'Legacy terminal analysis missing from reporting'; end if;
  insert into public.analysis_sessions(id,user_id,status,created_at,updated_at)
  values(stale,customer,'uploading',now()-interval '3 hours',now()-interval '3 hours'),
        (recent,customer,'uploading',now(),now()),
        (leased,customer,'processing',now()-interval '3 hours',now()-interval '3 hours');
  insert into public.analysis_stage_runs(session_id,pipeline_version,stage,input_checksum,status,attempt,started_at,updated_at,lease_token,lease_expires_at)
  values(leased,'test-v1','analyzing','test-input','running',1,now(),now(),gen_random_uuid(),now()+interval '1 hour');
  perform public.expire_stalled_analysis_sessions();
  if not exists(select 1 from public.analysis_sessions where id=stale and status='failed' and failure_code='ANALYSIS_INTERRUPTED') then raise exception 'Abandoned upload was not terminalized'; end if;
  if not exists(select 1 from public.analysis_sessions where id=recent and status='uploading') then raise exception 'Fresh upload was expired'; end if;
  if not exists(select 1 from public.analysis_sessions where id=leased and status='processing') then raise exception 'Live worker lease was expired'; end if;
  perform public.expire_stalled_analysis_sessions();
  if has_function_privilege('anon','public.expire_stalled_analysis_sessions()','execute') or has_table_privilege('authenticated','public.business_customer_accounts','select') then raise exception 'Maintenance or customer reporting exposed'; end if;
end $$;
select 'core lifecycle recovery passed' as result;
rollback;
