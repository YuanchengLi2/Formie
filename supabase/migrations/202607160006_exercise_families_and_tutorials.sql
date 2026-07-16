alter table public.analysis_sessions
  add column if not exists exercise_family text
    check (exercise_family in ('curl', 'triceps', 'press', 'overhead-press', 'fly', 'raise', 'row', 'pull-down', 'squat', 'lunge', 'hinge', 'hip-thrust', 'carry', 'core', 'plank', 'other')),
  add column if not exists tutorial_video jsonb
    check (tutorial_video is null or jsonb_typeof(tutorial_video) = 'object');

comment on column public.analysis_sessions.exercise_family is
  'Gemini-assigned movement family used to group analyses and select production exercise artwork.';

comment on column public.analysis_sessions.tutorial_video is
  'Cached, verified YouTube technique tutorial selected after a completed analysis.';
