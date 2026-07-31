begin;
select plan(47);

select has_table('public', 'analysis_sessions', 'analysis_sessions exists');
select has_table('public', 'analysis_results', 'analysis_results exists');
select has_table('public', 'coach_threads', 'coach_threads exists');
select has_table('public', 'coach_messages', 'coach_messages exists');
select has_table('public', 'user_profiles', 'user profiles exist');
select hasnt_table('public', 'user_memberships', 'mock membership table is removed');
select is((select count(*)::integer from public.exercises), 50, 'all 50 reference exercises are seeded');

select col_is_null('public', 'analysis_sessions', 'exercise_id', 'exercise match is optional');
select has_column('public', 'analysis_sessions', 'detected_label', 'detected label is persisted');
select has_column('public', 'analysis_sessions', 'detected_variation', 'detected variation is persisted');
select has_column('public', 'analysis_sessions', 'recognition_confidence', 'recognition confidence is persisted');
select has_column('public', 'analysis_sessions', 'previous_session_id', 'repeat recordings link to a prior session');
select has_column('public', 'analysis_sessions', 'corrected_label', 'label correction is stored separately');
select has_column('public', 'analysis_sessions', 'capture_orientation', 'capture orientation is persisted');
select has_column('public', 'analysis_sessions', 'requested_fps', 'Gemini sampling rate is persisted');
select has_column('public', 'analysis_sessions', 'set_declaration', 'user-declared set context is persisted');
select is(
  (select pg_get_expr(adbin, adrelid)
   from pg_attrdef
   where adrelid = 'public.analysis_sessions'::regclass
     and adnum = (select attnum from pg_attribute where attrelid = 'public.analysis_sessions'::regclass and attname = 'requested_fps')),
  '12',
  'requested_fps defaults to 12'
);
select like(
  (select pg_get_constraintdef(oid)
   from pg_constraint
   where conrelid = 'public.analysis_sessions'::regclass
     and conname = 'analysis_sessions_requested_fps_check'),
  '%requested_fps = 12%',
  'requested_fps only accepts 12'
);
select has_column('public', 'analysis_sessions', 'gemini_file_name', 'Gemini file identity is resumable');
select has_column('public', 'analysis_sessions', 'gemini_file_state', 'Gemini file state is resumable');
select hasnt_table('public', 'analysis_jobs', 'worker job table is removed');
select hasnt_table('public', 'pose_artifacts', 'pose artifact table is removed');

select has_column('public', 'analysis_results', 'video_check', 'video check is persisted');
select has_column('public', 'analysis_results', 'did_well', 'positive findings are persisted');
select has_column('public', 'analysis_results', 'priority_corrections', 'priority corrections are persisted');
select has_column('public', 'analysis_results', 'coaching_cues', 'coaching cues are persisted');
select has_column('public', 'analysis_results', 'set_context', 'whole-set coaching context is persisted');
select has_column('public', 'analysis_results', 'comparison', 'repeat comparison is persisted');
select has_column('public', 'coach_threads', 'session_id', 'coach thread selects one analyzed video');
select has_column('public', 'coach_threads', 'gemini_file_name', 'coach thread can reuse its private Gemini file');
select has_column('public', 'coach_messages', 'role', 'coach message role is persisted');
select has_function(
  'public',
  'search_exercise_variants',
  array['text', 'integer'],
  'exercise catalog exposes bounded name and alias search'
);
select ok(
  (select count(*) <= 12 from public.search_exercise_variants('press', 99)),
  'exercise search never returns more than 12 variants'
);
select is(
  (select name from public.search_exercise_variants('Dumbbell Bench Press', 12) limit 1),
  'Dumbbell Bench Press',
  'an exact exercise name ranks first'
);
select has_function(
  'public',
  'reset_analysis_for_reanalysis',
  array['uuid', 'uuid', 'jsonb'],
  'reanalysis can preserve or replace authoritative declaration context'
);
select has_function(
  'public',
  'commit_analysis_result',
  array['uuid', 'jsonb', 'jsonb'],
  'analysis result persistence and terminal session state commit atomically'
);

select ok((select relrowsecurity from pg_class where oid = 'public.analysis_sessions'::regclass), 'analysis_sessions has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.analysis_results'::regclass), 'analysis_results has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.coach_threads'::regclass), 'coach_threads has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.coach_messages'::regclass), 'coach_messages has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.user_profiles'::regclass), 'user profiles have RLS');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'user_profiles'), 3, 'user profiles expose only owner read, insert, and update policies');
select has_column('public', 'user_profiles', 'onboarding_step', 'onboarding progress is resumable');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'coach_messages'), 1, 'coach messages expose only owner read policy');
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'analysis_sessions'),
  4,
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
