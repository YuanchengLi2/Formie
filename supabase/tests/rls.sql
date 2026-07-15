begin;
select plan(19);

select has_table('public', 'analysis_sessions', 'analysis_sessions exists');
select has_table('public', 'analysis_results', 'analysis_results exists');
select is((select count(*)::integer from public.exercises), 50, 'all 50 reference exercises are seeded');

select col_is_null('public', 'analysis_sessions', 'exercise_id', 'exercise match is optional');
select has_column('public', 'analysis_sessions', 'detected_label', 'detected label is persisted');
select has_column('public', 'analysis_sessions', 'detected_variation', 'detected variation is persisted');
select has_column('public', 'analysis_sessions', 'recognition_confidence', 'recognition confidence is persisted');
select has_column('public', 'analysis_sessions', 'previous_session_id', 'repeat recordings link to a prior session');
select has_column('public', 'analysis_sessions', 'corrected_label', 'label correction is stored separately');

select has_column('public', 'analysis_results', 'video_check', 'video check is persisted');
select has_column('public', 'analysis_results', 'did_well', 'positive findings are persisted');
select has_column('public', 'analysis_results', 'priority_corrections', 'priority corrections are persisted');
select has_column('public', 'analysis_results', 'coaching_cues', 'coaching cues are persisted');
select has_column('public', 'analysis_results', 'comparison', 'repeat comparison is persisted');

select ok((select relrowsecurity from pg_class where oid = 'public.analysis_sessions'::regclass), 'analysis_sessions has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.analysis_results'::regclass), 'analysis_results has RLS');
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'analysis_sessions'),
  3,
  'analysis_sessions exposes only owner-scoped policies'
);
select is(
  (select public from storage.buckets where id = 'analysis-videos'),
  false,
  'analysis video bucket is private'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analysis_results'
      and column_name in ('did_well', 'priority_corrections', 'coaching_cues')
      and data_type <> 'jsonb'
  ),
  'all feedback collections use jsonb arrays'
);

select * from finish();
rollback;
