# Exhaustive Exercise Search Relevance Design

## Goal

Make Formie's exercise picker return credible exercises throughout typeahead for every active catalog exercise while preventing generated tempo, pause, partial-range, constant-tension, dead-stop, and other execution-style variants from polluting ordinary searches.

## Current failure and evidence

Production has 12,304 active `exercise_variants_v2` rows: 644 ordinary exercise variants and 11,660 generated execution-style variants. The current RPC searches all 12,304 rows before deciding whether the user asked for an execution style. Its ordering also places name and alias prefixes before the `execution_style is null` preference. As a result, ordinary queries such as `bench` and `bench press` return generated tempo or pause variants in the first five results.

The current matcher also treats exact whole-token matching and fuzzy fallback as separate global modes. It has no explicit token-prefix mode, so useful two- and three-letter typeahead can be empty or inconsistent. Everyday terms such as `bicep curl` and `bulgarian split squat` are not represented consistently in the catalog and therefore fail even though the intended exercise exists.

## Search contract

1. Every active ordinary exercise (`execution_style is null`) must be discoverable by its complete canonical name.
2. Query word order is irrelevant. Every meaningful query token must independently match a canonical name, alias, family, equipment/mechanics term, or an approved gym-language synonym.
3. Tokens can match exactly, by candidate-word prefix during typeahead, or by conservative trigram similarity for spelling errors. A result is eligible only when every meaningful query token matches by one of those paths.
4. Generic queries must exclude all rows whose `execution_style` is non-null. They are not merely demoted; they are ineligible.
5. Styled variants become eligible only when the normalized query explicitly contains a style signal represented by the generated catalog: numeric tempo notation; tempo; pause/paused; lengthened/shortened; partial; constant tension; dead stop; slow concentric; or one-and-a-half-rep wording.
6. When styles are requested, exact full names and aliases rank first, followed by complete phrase/prefix matches, strict all-token matches, token-prefix matches, and fuzzy matches.
7. The existing 20-result bound remains. The client preserves server order and continues rejecting any row that cannot prove every meaningful query token.

## Database design

Create `supabase/migrations/202608190002_exercise_search_relevance.sql` and replace `public.search_exercise_variants_v2(text, integer)` in place.

The live exhaustive audit also identified 16 legacy specialty rows whose names contain pause, tempo, partial-range, or isometric-hold modifiers but whose generated `execution_style` is null because their `mechanics` JSON omitted `executionStyle`. Create `supabase/migrations/202608190003_reclassify_legacy_exercise_styles.sql` to repair that source data in `mechanics`, allow the stored generated column to recompute, and replace the RPC with isometric/hold eligibility support. This prevents legacy rows from bypassing the structured style filter.

The function will:

- Normalize the query by unaccenting, lowercasing before punctuation removal, and collapsing whitespace.
- Expand established gym vocabulary (`db`, `bb`, singular/plural arm terms, `bicep`, `tricep`, `rdl`, `ohp`, `pushup`, `pulldown`, and Bulgarian split-squat wording) without weakening the all-token requirement.
- Build a normalized searchable document for every active row from canonical name, aliases, category, family, equipment, mechanics, and narrowly scoped derived synonyms.
- Split both the query and document into tokens so prefix matching is a token operation rather than a broad substring operation.
- Filter `execution_style is null` before candidate matching unless the query explicitly requests an execution style.
- Assign a deterministic match tier: exact canonical/alias, canonical/alias phrase prefix, strict all-token, all-token prefix, then all-token fuzzy.
- Rank by tier, direct phrase containment, non-styled preference when style results are allowed, similarity, shorter canonical name, then name/id for stable output.
- Keep the legacy `search_exercise_variants` RPC routed through v2 with its twelve-result cap.

The live style-family audit showed that recomputing normalization for thousands of styled rows on every explicit style query can exceed the hosted statement timeout. Create `supabase/migrations/202608190004_precompute_exercise_search_documents.sql` to add stored normalized-name, normalized-alias, and search-document columns to `exercise_variants_v2`, backfill every active and inactive row, and maintain them with a focused trigger whenever source catalog fields change. The RPC will consume those stored documents instead of rebuilding them per request. This is the scalable search boundary for both the 628 ordinary rows and all explicitly requested style variants.

The broad relevance matrix identified a separate semantic issue: category and movement-family metadata could combine with a name token to produce a related but incorrect exercise (`leg extension` matched `Single Leg Hip Thrust` through its `hip-extension` family). Create `supabase/migrations/202608190005_tighten_exercise_search_documents.sql` to rebuild persisted documents from canonical name, aliases, equipment, structured execution style, and explicit gym-language synonyms only. Returning fewer credible rows is preferable to padding the list with biomechanically related movements.

No client-side catalog download or local re-ranking will be added. The database remains the single ranking boundary.

## Client design

Modify `src/features/analysis/exercise-catalog.ts` only where the credibility gate must understand the same vocabulary as the database. Add biceps/curl, Bulgarian split-squat, RDL, OHP, push-up, and related equivalences to normalization/query groups. Preserve the rule that every query group must match; do not allow server-provided `matched_terms` to bypass that gate.

The picker already searches after two characters with a 180 ms debounce, ignores stale requests, and renders the RPC order. No UI structure or timing change is required.

## Verification design

`supabase/tests/rls.sql` will cover database behavior directly:

- Generic searches return no styled rows.
- An explicit style query returns the matching style row.
- Two-character prefixes return ordinary exercises.
- Reversed word order and one-edit misspellings return credible matches.
- `bicep curl` and `bulgarian split squat` resolve.
- A set-based database invariant proves every active ordinary exercise has a non-empty, unique normalized canonical name, which guarantees a unique exact-name ranking tier without hundreds of nested RPC calls.
- A representative row for each distinct execution style is discoverable by its full styled name.

`src/features/analysis/exercise-catalog.test.ts` will prove the client credibility gate accepts the new gym-language equivalences and still rejects unrelated rows.

After deployment, a live production audit will call the actual anonymous RPC for every one of the 644 ordinary exercises by full name, one representative of each of the 20 generated style types by full name, a broad typeahead matrix, misspellings, word-order permutations, and generic queries checked for zero styled rows. This exhaustive runtime audit remains outside pgTAP because 644 nested RPC executions exceed the hosted database statement timeout.

## Files

- Create `supabase/migrations/202608190002_exercise_search_relevance.sql`: authoritative eligibility, token matching, vocabulary expansion, and ranking implementation.
- Create `supabase/migrations/202608190003_reclassify_legacy_exercise_styles.sql`: repair the 16 legacy rows' missing `mechanics.executionStyle` data and extend explicit style detection to isometric/hold queries.
- Create `supabase/migrations/202608190004_precompute_exercise_search_documents.sql`: persist and automatically maintain normalized search documents, index them, and replace the RPC so explicit style searches no longer time out.
- Create `supabase/migrations/202608190005_tighten_exercise_search_documents.sql`: remove broad family/category terms from eligibility documents and rebuild all rows so related-but-wrong movements cannot fill result slots.
- Modify `supabase/tests/rls.sql`: catalog-wide and behavioral database regression tests; increment the pgTAP plan count for every added assertion.
- Modify `src/features/analysis/exercise-catalog.ts`: keep the client credibility vocabulary aligned with the RPC.
- Modify `src/features/analysis/exercise-catalog.test.ts`: client-side synonym, typo, order, and unrelated-result regression tests.

No other source files are required for this search correction.
