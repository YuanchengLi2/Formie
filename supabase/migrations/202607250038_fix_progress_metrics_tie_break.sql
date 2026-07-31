-- Migration 202607250037 was already deployed before its first authenticated
-- live call exposed PL/pgSQL's ambiguity between the average_score local
-- variable and the family_scores column. Preserve the function exactly and
-- qualify the tie-break columns in a forward-only repair.
do $migration$
declare
  original_definition text;
  repaired_definition text;
begin
  select pg_get_functiondef('public.get_progress_metrics(text)'::regprocedure)
  into original_definition;

  repaired_definition := replace(
    original_definition,
    'order by average_score desc, scored_sessions desc, latest_activity desc, exercise_family asc',
    'order by family_scores.average_score desc, family_scores.scored_sessions desc, family_scores.latest_activity desc, family_scores.exercise_family asc'
  );

  if repaired_definition <> original_definition then
    execute repaired_definition;
  end if;
end;
$migration$;
