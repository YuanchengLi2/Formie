begin;
select plan(75);

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
select has_column('public', 'analysis_sessions', 'capture_flow_id', 'analysis links to a privacy-safe capture flow');
select has_column('public', 'analysis_sessions', 'app_session_id', 'analysis links to an app session');
select has_table('public', 'analytics_identity_links', 'privacy-limited anonymous identity links exist');
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
select has_function(
  'public',
  'search_exercise_variants_v2',
  array['text', 'integer'],
  'v2 exercise catalog search is available at the RPC boundary'
);
select has_column(
  'public',
  'exercise_variants_v2',
  'search_normalized_name',
  'exercise variants persist their normalized canonical search name'
);
select has_column(
  'public',
  'exercise_variants_v2',
  'search_normalized_aliases',
  'exercise variants persist normalized aliases for exact ranking'
);
select has_column(
  'public',
  'exercise_variants_v2',
  'search_text',
  'exercise variants persist the full search document'
);
select ok(
  not exists (
    select 1
    from public.exercise_variants_v2
    where search_normalized_name is null
      or search_normalized_aliases is null
      or search_text is null
  ),
  'every exercise variant has a precomputed search document'
);
select ok(
  (select count(*) <= 20 from public.search_exercise_variants_v2('press', 99)),
  'v2 exercise search clamps the requested result count to twenty'
);
select is(
  (select name from public.search_exercise_variants_v2('Dumbbell Bench Press', 20) limit 1),
  'Flat Dumbbell Bench Press',
  'v2 exact exercise search ranks the canonical base variation first'
);
select ok(
  (select count(*) <= 12 from public.search_exercise_variants('press', 99)),
  'exercise search never returns more than 12 variants'
);
select is(
  (select name from public.search_exercise_variants('Dumbbell Bench Press', 12) limit 1),
  'Flat Dumbbell Bench Press',
  'the legacy search wrapper uses the corrected canonical base ranking'
);
select ok(
  not exists (
    select 1
    from (values ('bench press'), ('deadlift'), ('squat'), ('leg extension')) as query(value)
    cross join lateral public.search_exercise_variants_v2(query.value, 20) as result
    where result.execution_style is not null
      or lower(result.name) ~ '(^| )(tempo|pause|paused|partial|isometric)( |$)'
  ),
  'generic exercise searches exclude generated and legacy execution styles'
);
select ok(
  exists (
    select 1
    from public.search_exercise_variants_v2('1 second pause bench press', 20)
    where execution_style in ('1-second-lengthened-pause', '1-second-shortened-pause')
  ),
  'explicit style wording makes matching styled variants eligible'
);
select ok(
  exists (
    select 1
    from public.search_exercise_variants_v2('be', 20)
    where execution_style is null
      and lower(name) like '%be%'
  ),
  'two-character typeahead returns an ordinary matching exercise'
);
select ok(
  exists (
    select 1
    from public.search_exercise_variants_v2('bicep curl', 20)
    where execution_style is null
      and lower(name) like '%curl%'
  ),
  'ordinary bicep wording resolves to curl exercises'
);
select ok(
  exists (
    select 1
    from public.search_exercise_variants_v2('bulgarian split squat', 20)
    where execution_style is null
      and lower(name) like '%rear foot elevated split squat%'
  ),
  'Bulgarian split squat wording resolves to rear-foot-elevated variants'
);
select ok(
  exists (
    select 1
    from public.search_exercise_variants_v2('pres bench dumbell', 20)
    where execution_style is null
      and lower(name) like '%dumbbell%bench press%'
  ),
  'word order and one-edit spelling errors still resolve to the intended exercise'
);
select ok(
  not exists (
    select 1
    from public.search_exercise_variants_v2('leg extension', 20)
    where lower(name) not like '%leg extension%'
  ),
  'exercise-name searches do not pad results with biomechanically related movements'
);
select ok(
  not exists (
    select 1
    from public.exercise_variants_v2 as variant
    where variant.is_active
      and variant.execution_style is null
      and trim(regexp_replace(
        extensions.unaccent(lower(variant.name)),
        '[^a-z0-9]+', ' ', 'g'
      )) = ''
  )
  and (
    select count(*) = count(distinct trim(regexp_replace(
      extensions.unaccent(lower(variant.name)),
      '[^a-z0-9]+', ' ', 'g'
    )))
    from public.exercise_variants_v2 as variant
    where variant.is_active
      and variant.execution_style is null
  ),
  'every active ordinary catalog exercise has a unique searchable canonical name'
);
select ok(
  not exists (
    select 1
    from (
      select distinct on (variant.execution_style)
        variant.id,
        variant.name,
        variant.execution_style
      from public.exercise_variants_v2 as variant
      where variant.is_active
        and variant.execution_style is not null
      order by variant.execution_style, variant.id
    ) as sample
    where not exists (
      select 1
      from public.search_exercise_variants_v2(sample.name, 20) as result
      where result.id = sample.id
    )
  ),
  'every generated execution-style family is discoverable by a complete styled name'
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
select has_function(
  'public',
  'fail_preprocessing_analysis',
  array['uuid', 'uuid', 'uuid', 'text'],
  'pre-processing upload failure and credit release are atomic'
);
select ok(
  not has_function_privilege('authenticated', 'public.fail_preprocessing_analysis(uuid,uuid,uuid,text)', 'EXECUTE'),
  'authenticated clients cannot invoke the service-role preprocessing failure function'
);
select ok(
  not has_function_privilege('anon', 'public.fail_preprocessing_analysis(uuid,uuid,uuid,text)', 'EXECUTE'),
  'anonymous clients cannot invoke the service-role preprocessing failure function'
);

select ok((select relrowsecurity from pg_class where oid = 'public.analysis_sessions'::regclass), 'analysis_sessions has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.analysis_results'::regclass), 'analysis_results has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.coach_threads'::regclass), 'coach_threads has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.coach_messages'::regclass), 'coach_messages has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.user_profiles'::regclass), 'user profiles have RLS');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'user_profiles'), 3, 'user profiles expose only owner read, insert, and update policies');
select has_column('public', 'user_profiles', 'onboarding_step', 'onboarding progress is resumable');
select has_column('public', 'user_profiles', 'age_years', 'approved onboarding age is persisted');
select has_column('public', 'user_profiles', 'gender', 'approved onboarding gender is persisted');
select has_column('public', 'user_profiles', 'height_cm', 'canonical height is persisted');
select has_column('public', 'user_profiles', 'weight_kg', 'canonical weight is persisted');
select has_column('public', 'user_profiles', 'measurement_system', 'display measurement system is persisted');
select has_column('public', 'user_profiles', 'biggest_frustration', 'approved frustration is persisted');
select has_column('public', 'user_profiles', 'workouts_per_week', 'training frequency is persisted');
select has_column('public', 'user_profiles', 'custom_milestone', 'custom milestone is persisted');
select has_column('public', 'user_profiles', 'onboarding_version', 'onboarding schema version is persisted');
select has_column('public', 'user_profiles', 'marketing_opt_in', 'optional marketing consent is persisted');
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
