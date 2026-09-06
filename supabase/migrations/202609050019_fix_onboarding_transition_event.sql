-- The durable client and ingestion schema both use onboarding_cta_pressed.
-- Repair the reporting function that was looking for a never-ingested name.
do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.get_founder_business_dashboard(text,text,date,date)'::regprocedure) into v_definition;
  if strpos(v_definition,'''onboarding_cta_tapped''')>0 then
    execute replace(v_definition,'''onboarding_cta_tapped''','''onboarding_cta_pressed''');
  elsif strpos(v_definition,'''onboarding_cta_pressed''')=0 then
    raise exception 'FOUNDER_REPORTING_ONBOARDING_EVENT_NOT_RECOGNIZED';
  end if;
end $$;
