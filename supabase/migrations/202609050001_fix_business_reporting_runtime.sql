-- Repair the founder reporting function without rewriting the already-applied
-- 202609040014 migration. The lateral link record must project the primary key
-- used by referral-visit and exclusion subqueries.
do $$
declare
  v_definition text;
  v_search constant text:='left join lateral (select creator_link.public_slug,creator_link.status from';
  v_replacement constant text:='left join lateral (select creator_link.id,creator_link.public_slug,creator_link.status from';
begin
  select pg_get_functiondef('public.get_founder_business_dashboard(text,text,date,date)'::regprocedure)
  into v_definition;
  if strpos(v_definition,v_search)=0 then
    raise exception 'FOUNDER_REPORTING_DEFINITION_NOT_RECOGNIZED';
  end if;
  execute replace(v_definition,v_search,v_replacement);
end $$;
