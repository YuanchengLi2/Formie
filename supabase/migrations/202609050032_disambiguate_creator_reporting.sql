-- Qualify local tenant variables instead of colliding with table creator_id columns.
do $$
declare definition text; signature regprocedure;
begin
  foreach signature in array array[
    'public.get_creator_dashboard_v5(text,date,date,integer,integer)'::regprocedure,
    'public.get_founder_business_dashboard_v8(text,text,date,date)'::regprocedure
  ] loop
    definition:=pg_get_functiondef(signature);
    definition:=replace(definition,'creator_id uuid','v_selected_creator_id uuid');
    definition:=replace(definition,'into creator_id','into v_selected_creator_id');
    definition:=replace(definition,'if creator_id is null','if v_selected_creator_id is null');
    definition:=replace(definition,'creator_id:=','v_selected_creator_id:=');
    definition:=replace(definition,'=creator_id','=v_selected_creator_id');
    execute definition;
  end loop;
end $$;
