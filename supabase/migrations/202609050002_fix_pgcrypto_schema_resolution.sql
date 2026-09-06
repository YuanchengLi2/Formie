-- Supabase installs pgcrypto in the extensions schema. Repair applied function
-- definitions that used a public-schema qualifier for digest().
do $$
declare
  v_signature regprocedure;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.redact_deleted_account_business_data(uuid)'::regprocedure,
    'public.get_founder_business_dashboard(text,text,date,date)'::regprocedure,
    'public.get_creator_dashboard_v1(text)'::regprocedure
  ] loop
    select pg_get_functiondef(v_signature) into v_definition;
    if strpos(v_definition,'public.digest')=0 then
      raise exception 'PGCRYPTO_FUNCTION_DEFINITION_NOT_RECOGNIZED: %',v_signature;
    end if;
    execute replace(v_definition,'public.digest','extensions.digest');
  end loop;
end $$;
