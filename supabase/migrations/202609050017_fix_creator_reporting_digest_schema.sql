-- get_creator_dashboard_v2 was added after the earlier pgcrypto repair, so
-- qualify its pseudonymous identifier hashing against the installed schema.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.get_creator_dashboard_v2(text,integer,integer)'::regprocedure)
  into v_definition;
  if strpos(v_definition,'public.digest')>0 then
    execute replace(v_definition,'public.digest','extensions.digest');
  end if;
end $$;
