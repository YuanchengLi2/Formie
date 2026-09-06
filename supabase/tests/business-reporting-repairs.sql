begin;

do $$
declare
  v_inside uuid:=gen_random_uuid();
  v_after uuid:=gen_random_uuid();
  v_reservation uuid:=gen_random_uuid();
  v_attempt uuid:=gen_random_uuid();
  v_dashboard jsonb;
  v_new_users integer;
  v_first_analysis integer;
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
    (v_inside,'authenticated','authenticated','report-inside-'||v_inside||'@example.invalid','2099-01-10','2099-01-10','2099-01-10'),
    (v_after,'authenticated','authenticated','report-after-'||v_after||'@example.invalid','2099-02-10','2099-02-10','2099-02-10');
  insert into public.onboarding_reporting_snapshots(
    user_id,onboarding_version,completed_at,age_range,gender,experience,primary_goal,biggest_frustration,
    workouts_per_week,milestone_theme,self_reported_source
  ) values(v_inside,'approved-v1','2099-01-10','25-34','prefer_not_to_say','beginner','get_stronger','plateau',4,'strength','youtube');
  insert into public.analysis_credit_reservations(
    id,user_id,client_request_id,kind,status,period_start,period_end,funding_source,committed_at
  ) values(v_reservation,v_inside,'reporting-repair-analysis','analysis','committed','2099-01-01','2099-02-01','base','2099-01-12');
  insert into public.analysis_attempts(
    id,reservation_id,user_id,kind,status,started_at,terminal_at,created_at,updated_at
  ) values(v_attempt,v_reservation,v_inside,'analysis','complete','2099-01-12','2099-01-12','2099-01-12','2099-01-12');

  v_dashboard:=public.get_founder_business_dashboard_v10('growth','custom','2099-01-01','2099-01-31');
  v_new_users:=(v_dashboard#>>'{metrics,newUsers,value}')::integer;
  select (item->>'users')::integer into v_first_analysis
  from jsonb_array_elements(v_dashboard#>'{growth,onboardingFunnel}') item
  where item->>'label'='first_analysis';
  if v_new_users<>1 then raise exception 'CUSTOM_RANGE_LEAKED_FUTURE_USERS: expected 1, got %',v_new_users; end if;
  if v_first_analysis<>0 then raise exception 'FUNNEL_SKIPPED_PAYMENT_STAGE: expected 0, got %',v_first_analysis; end if;
end $$;

rollback;

begin;

do $$
declare
  v_user uuid:=gen_random_uuid();
  v_measured uuid:=gen_random_uuid();
  v_unmeasured uuid:=gen_random_uuid();
  v_dashboard jsonb;
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
  values(v_user,'authenticated','authenticated','processing-runtime-'||v_user||'@example.invalid','2099-01-10','2099-01-10','2099-01-10');

  insert into public.analysis_sessions(
    id,user_id,status,stage,created_at,updated_at,completed_at,analysis_total_duration_ms
  ) values
    (v_measured,v_user,'complete','complete','2099-01-12 12:00:00+00','2099-01-12 12:00:05+00','2099-01-12 12:00:05+00',4321),
    (v_unmeasured,v_user,'complete','complete','2099-01-13 12:00:00+00','2099-01-13 12:00:09+00','2099-01-13 12:00:09+00',null);

  v_dashboard:=public.get_founder_business_dashboard_v10('growth','custom','2099-01-01','2099-01-31');
  if (v_dashboard#>>'{metrics,processingTime,value}')::numeric<>4321 then
    raise exception 'PROCESSING_TIME_NOT_MEASURED_RUNTIME: expected 4321, got %',v_dashboard#>>'{metrics,processingTime,value}';
  end if;
  if v_dashboard#>>'{metrics,processingTime,quality}'<>'incomplete' then
    raise exception 'PROCESSING_TIME_COVERAGE_NOT_EXPOSED: expected incomplete, got %',v_dashboard#>>'{metrics,processingTime,quality}';
  end if;
  if (v_dashboard#>>'{metrics,processingTime,numerator}')::integer<>1
     or (v_dashboard#>>'{metrics,processingTime,denominator}')::integer<>2 then
    raise exception 'PROCESSING_TIME_COUNTS_INCORRECT';
  end if;
end $$;

rollback;
