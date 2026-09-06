create or replace function public.business_recalculate_cohort_percentages(p_rows jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare item jsonb; result jsonb:='[]'::jsonb; numerator numeric; denominator numeric;
begin
  for item in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    if item ? 'd7Eligible' then
      numerator:=coalesce((item->>'d7Users')::numeric,0); denominator:=coalesce((item->>'d7Eligible')::numeric,0);
      item:=jsonb_set(item,'{d7Percent}',case when denominator=0 then 'null'::jsonb else to_jsonb(round(100*numerator/denominator,1)) end);
    end if;
    if item ? 'd30Eligible' then
      numerator:=coalesce((item->>'d30Users')::numeric,0); denominator:=coalesce((item->>'d30Eligible')::numeric,0);
      item:=jsonb_set(item,'{d30Percent}',case when denominator=0 then 'null'::jsonb else to_jsonb(round(100*numerator/denominator,1)) end);
    end if;
    result:=result||jsonb_build_array(item);
  end loop;
  return result;
end $$;

create or replace function public.get_founder_business_dashboard_v10(
  p_section text default 'overview',p_window text default '30d',p_start date default null,p_end date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; growth jsonb;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  result:=public.get_founder_business_dashboard_v9(p_section,p_window,p_start,p_end);
  growth:=coalesce(result->'growth','{}'::jsonb);
  growth:=jsonb_set(growth,'{retentionByAcquisition}',public.business_recalculate_cohort_percentages(growth->'retentionByAcquisition'));
  growth:=jsonb_set(growth,'{retentionByCreator}',public.business_recalculate_cohort_percentages(growth->'retentionByCreator'));
  growth:=jsonb_set(growth,'{retentionByExperience}',public.business_recalculate_cohort_percentages(growth->'retentionByExperience'));
  growth:=jsonb_set(growth,'{retentionByGoal}',public.business_recalculate_cohort_percentages(growth->'retentionByGoal'));
  growth:=jsonb_set(growth,'{bonusComparison}',public.business_recalculate_cohort_percentages(growth->'bonusComparison'));
  growth:=jsonb_set(growth,'{firstWeekAnalysisDepth}',public.business_recalculate_cohort_percentages(growth->'firstWeekAnalysisDepth'));
  return jsonb_set(result,'{growth}',growth);
end $$;

revoke all on function public.business_recalculate_cohort_percentages(jsonb),public.get_founder_business_dashboard_v10(text,text,date,date) from public,anon,authenticated;
grant execute on function public.business_recalculate_cohort_percentages(jsonb),public.get_founder_business_dashboard_v10(text,text,date,date) to service_role;
