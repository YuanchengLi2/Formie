alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_input_strategy_check,
  drop constraint if exists analysis_sessions_preprocessing_consistency;

alter table public.analysis_sessions
  add constraint analysis_sessions_input_strategy_check
    check (analysis_input_strategy in ('video', 'trimmed_crop', 'upright_video')),
  add constraint analysis_sessions_preprocessing_consistency check (
    (
      analysis_input_strategy = 'video'
      and analysis_video_path is null
      and analysis_duration_ms is null
      and analysis_source_start_ms is null
      and analysis_source_end_ms is null
      and analysis_crop is null
      and analysis_preprocessing_confidence is null
    )
    or
    (
      analysis_input_strategy = 'trimmed_crop'
      and analysis_video_path is not null
      and analysis_duration_ms between 3000 and 45000
      and analysis_source_start_ms >= 0
      and analysis_source_end_ms > analysis_source_start_ms
      and analysis_duration_ms = analysis_source_end_ms - analysis_source_start_ms
      and jsonb_typeof(analysis_crop) = 'object'
      and analysis_preprocessing_confidence between 0.9 and 1
    )
    or
    (
      analysis_input_strategy = 'upright_video'
      and analysis_video_path is not null
      and analysis_duration_ms = duration_ms
      and analysis_source_start_ms = 0
      and analysis_source_end_ms = duration_ms
      and analysis_crop is null
      and analysis_preprocessing_confidence = 1
    )
  );
