create or replace function public.commit_analysis_result_v2(
  p_session_id uuid,
  p_session jsonb,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.commit_analysis_result(
    p_session_id,
    p_session,
    case
      when p_result -> 'comparison' = 'null'::jsonb then p_result - 'comparison'
      else p_result
    end
  );
end;
$$;

revoke all on function public.commit_analysis_result_v2(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_analysis_result_v2(uuid, jsonb, jsonb) to service_role;

comment on function public.commit_analysis_result_v2(uuid, jsonb, jsonb) is
  'Atomically persists a validated public result while normalizing optional JSON nulls to SQL nulls.';
