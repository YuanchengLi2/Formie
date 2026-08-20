# Exhaustive Exercise Search Relevance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. Repository instructions prohibit subagents, so no subagent-driven execution or document review is permitted. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every active Formie catalog exercise discoverable with flexible word order, prefixes, common gym wording, and spelling tolerance while removing generated execution-style variants from generic results.

**Architecture:** Keep PostgreSQL as the sole retrieval and ranking boundary. Replace the v2 RPC with a token-based eligibility and match-tier pipeline, align the client's credibility vocabulary with that pipeline, and prove behavior through pgTAP, focused Jest tests, catalog-wide SQL invariants, and live anonymous REST calls.

**Tech Stack:** PostgreSQL 17, Supabase/PostgREST RPC, `pg_trgm`, `unaccent`, pgTAP, TypeScript, Zod, Jest, React Native/Expo.

---

## File map

- `supabase/migrations/202608190002_exercise_search_relevance.sql` (create): replace the production search function, style eligibility rules, normalized search document, per-token exact/prefix/fuzzy matching, stable ranking, grants, and legacy wrapper.
- `supabase/migrations/202608190003_reclassify_legacy_exercise_styles.sql` (create): repair legacy pause/tempo/partial/isometric rows whose generated `execution_style` was null because `mechanics.executionStyle` was absent, then extend explicit style eligibility for isometric/hold wording.
- `supabase/migrations/202608190004_precompute_exercise_search_documents.sql` (create): add and backfill persisted search-document columns, maintain them through a catalog trigger, index normalized text, and replace the RPC to read precomputed values.
- `supabase/migrations/202608190005_tighten_exercise_search_documents.sql` (create): narrow persisted documents to canonical/alias/equipment/style text plus explicit synonyms, then rebuild every row to prevent related-but-wrong matches.
- `supabase/tests/rls.sql` (modify): executable database contract for generic/style separation, typeahead, spelling/order flexibility, gym vocabulary, catalog-wide base discoverability, and all style families.
- `src/features/analysis/exercise-catalog.ts` (modify): mirror server vocabulary only for the existing credibility gate; keep server ranking authoritative and require every query group to match.
- `src/features/analysis/exercise-catalog.test.ts` (modify): fail first for the missing equivalences and prove unrelated-result rejection remains intact.

No picker UI file changes are needed because `src/screens/exercise-selection/index.tsx` already debounces at 180 ms, begins searching at two characters, preserves response order, and cancels stale requests.

### Task 1: Add failing client vocabulary tests

**Files:**
- Modify: `src/features/analysis/exercise-catalog.test.ts`
- Test: `src/features/analysis/exercise-catalog.test.ts`

- [ ] **Step 1: Extend the table-driven ordinary-gym-wording test**

Add cases that represent currently failing but valid user language:

```ts
["bicep curl", "Dumbbell Standing Curl"],
["bulgarian split squat", "Dumbbell Rear Foot Elevated Split Squat"],
["rdl dumbell", "Dumbbell Romanian Deadlift"],
["ohp barbell", "Barbell Overhead Press"],
["pushup", "Push Up"],
```

Each loader returns exactly the named credible row so this tests the real client gate rather than mock ordering.

- [ ] **Step 2: Add a word-order and misspelling test**

Use `press bench dumbell` against `Flat Dumbbell Bench Press` and require acceptance. Keep the existing stale `matched_terms` test unchanged so the vocabulary additions cannot make unrelated rows credible.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```powershell
node .\node_modules\jest\bin\jest.js --runInBand --runTestsByPath src\features\analysis\exercise-catalog.test.ts
```

Expected: the new bicep, Bulgarian split-squat, RDL/OHP, or spelling case fails because the current query groups cannot map all input terms to the returned row.

### Task 2: Align the client credibility vocabulary

**Files:**
- Modify: `src/features/analysis/exercise-catalog.ts`
- Test: `src/features/analysis/exercise-catalog.test.ts`

- [ ] **Step 1: Add narrow query-group equivalences**

Extend `QUERY_EXPANSIONS` with bidirectional terms that correspond to real catalog language:

```ts
bicep: ["biceps", "curl"],
biceps: ["bicep", "curl"],
rdl: ["romanian"],
ohp: ["overhead"],
pushup: ["push", "up"],
```

Keep equipment abbreviations and singular/plural normalization. Do not add broad anatomy-to-movement mappings that would allow unrelated rows.

- [ ] **Step 2: Normalize established multi-word names before token grouping**

Update `expandQuery` so both `bulgarian squat` and `bulgarian split squat` become `rear foot elevated split squat`. Normalize `pushup` to `push up`, while keeping order-insensitive matching in `queryGroups`.

- [ ] **Step 3: Run the focused test and verify GREEN**

Run the Task 1 Jest command. Expected: all client catalog tests pass, including stale-response rejection.

### Task 3: Add failing database search contracts

**Files:**
- Modify: `supabase/tests/rls.sql`
- Test: `supabase/tests/rls.sql`

- [ ] **Step 1: Increase the pgTAP plan count by the exact number of new assertions**

Add twelve assertions and change `select plan(59);` to `select plan(71);`. The four additional assertions require the three persisted search-document columns and prove every catalog row is backfilled.

- [ ] **Step 2: Add generic/style eligibility assertions**

Add SQL equivalent to:

```sql
select ok(
  not exists (
    select 1 from public.search_exercise_variants_v2('bench press', 20)
    where execution_style is not null
  ),
  'generic exercise searches exclude generated execution styles'
);

select ok(
  exists (
    select 1 from public.search_exercise_variants_v2('1 second pause bench press', 20)
    where execution_style in ('1-second-lengthened-pause', '1-second-shortened-pause')
  ),
  'explicit style wording makes matching styled variants eligible'
);
```

- [ ] **Step 3: Add prefix, vocabulary, order, and typo assertions**

Assert non-empty credible results for `be`, `bicep curl`, `bulgarian split squat`, and `press bench dumbell`. Assertions must inspect returned names/mechanics, not only row counts.

- [ ] **Step 4: Add the set-based catalog-wide base invariant**

Normalize every active row with `execution_style is null` in one set operation. Assert that no canonical name normalizes to an empty string and that the normalized canonical names are unique. Unique, non-empty names make the RPC's exact-name tier deterministic. Do not call the RPC 644 times inside pgTAP: that exceeds the hosted statement timeout. The actual 644-call RPC proof remains required in Task 5's concurrent live audit.

- [ ] **Step 5: Add the execution-style family invariant**

Choose one active row per distinct non-null `execution_style`, search by its complete styled name, and assert that the same row is present. This verifies all 20 generated style families without executing an unnecessary 11,660-by-12,304 exhaustive cross-product.

- [ ] **Step 6: Run the database test against a rollback transaction and verify RED**

Use the authenticated Supabase database-query endpoint to execute the relevant new assertions inside `begin; ... rollback;`, or `npx supabase test db supabase/tests/rls.sql --linked --profile formie` if the CLI profile parser is repaired. Expected: generic style exclusion, two-character prefix, bicep, Bulgarian, and catalog-wide discoverability fail against the current production function.

### Task 4: Implement authoritative SQL eligibility and matching

**Files:**
- Create: `supabase/migrations/202608190002_exercise_search_relevance.sql`
- Test: `supabase/tests/rls.sql`

- [ ] **Step 1: Copy the v2 function signature and security boundary**

Use `language sql`, `stable`, `security invoker`, and `set search_path = pg_catalog, public, extensions`. Preserve the returned columns and 20-row clamp so the existing client contract is unchanged.

- [ ] **Step 2: Normalize the query and detect explicit styles**

Lowercase and unaccent before replacing punctuation. Build `style_requested` from the normalized full query using tokens/regular expressions covering every catalog execution-style family: numeric tempo, tempo, pause, lengthened, shortened, partial, constant tension, dead stop, slow concentric, and 1.5/one-and-a-half rep wording.

- [ ] **Step 3: Build query alternatives and searchable tokens**

Represent each meaningful query token with exact, singular, and approved equivalent forms. Build candidate documents from name, aliases, category, family, equipment class, mechanics values, and derived narrow synonyms such as `curl -> bicep/biceps` and `rear foot elevated split squat -> Bulgarian split squat`.

- [ ] **Step 4: Filter style rows before matching**

In the `searchable` CTE require:

```sql
variant.is_active
and (query_flags.style_requested or variant.execution_style is null)
```

This is the root correction that prevents 11,660 generated rows from competing in ordinary searches.

- [ ] **Step 5: Compute one deterministic match tier per row**

Use lateral candidate tokens and require every meaningful query token to satisfy one of:

1. exact token/equivalent;
2. candidate token starts with the query token for two-character-or-longer typeahead;
3. `word_similarity` at a conservative threshold for four-character-or-longer spelling tolerance.

Reject the row if any query token is unmatched. Assign exact canonical/alias, phrase prefix, strict token, token prefix, and fuzzy tiers for ordering.

- [ ] **Step 6: Rank and preserve the legacy wrapper**

Order by match tier, direct phrase containment, style-null preference when styles were requested, trigram similarity, canonical-name length, normalized name, and id. Replace the legacy RPC wrapper and reapply grants to `anon` and `authenticated`.

- [ ] **Step 7: Dry-run the migration and verify GREEN database contracts**

Execute the migration and new pgTAP assertions inside one transaction ending in `rollback`. Expected: all new assertions and the existing database contract pass.

### Task 5: Deploy and prove production behavior

**Files:**
- Deploy: `supabase/migrations/202608190002_exercise_search_relevance.sql`
- Deploy: `supabase/migrations/202608190003_reclassify_legacy_exercise_styles.sql`
- Deploy: `supabase/migrations/202608190004_precompute_exercise_search_documents.sql`
- Deploy: `supabase/migrations/202608190005_tighten_exercise_search_documents.sql`

- [ ] **Step 1: Apply the migration atomically**

Use the authenticated Formie project `jnprpjnnjyrhvfeflpju`. Apply migration `202608190002` and record it in `supabase_migrations.schema_migrations`. If the exhaustive audit finds legacy specialty names with null structured style metadata, add and dry-run `202608190003`, update those rows' `mechanics.executionStyle` values so the stored generated column recomputes, replace the RPC with isometric/hold eligibility, and apply/record that migration atomically. Do not expose the personal access token or service key in output.

If explicit style-family calls still hit statement timeouts, add `202608190004` rather than retries: persist `search_normalized_name`, `search_normalized_aliases`, and `search_text`; backfill all rows; add a trigger that recomputes them from name/aliases/category/family/mechanics; index `search_text`; and replace the RPC's per-row normalization CTE with direct reads of those columns. Dry-run the schema, trigger maintenance, behavior matrix, and style sweep before applying and recording the migration.

- [ ] **Step 2: Verify migration parity and anonymous permissions**

Confirm the migration version exists once, both v2 and legacy RPCs execute as `anon`, and the v2 limit remains 20.

- [ ] **Step 3: Run the live catalog-wide audit**

Verify all 644 active ordinary rows find themselves by complete name. Verify one row for each of the 20 style families finds itself by complete styled name. Record failure IDs and names; completion requires zero failures.

- [ ] **Step 4: Run live relevance matrices**

Test two- and three-letter prefixes, word-order permutations, abbreviations, one-edit misspellings, and common gym language. For generic queries such as `bench`, `bench press`, `squat`, `deadlift`, `leg extension`, `curl`, and `row`, assert every returned row has `execution_style is null`. For explicit style queries, assert the requested style is present.

### Task 6: Final regression verification

**Files:**
- Verify all files listed in the file map plus the existing UI changes already in the worktree.

- [ ] **Step 1: Run focused search tests**

```powershell
node .\node_modules\jest\bin\jest.js --runInBand --forceExit --runTestsByPath src\features\analysis\exercise-catalog.test.ts src\screens\exercise-selection\exercise-selection.test.tsx
```

Expected: all suites and tests pass.

- [ ] **Step 2: Run the broader post-recording regression set**

```powershell
node .\node_modules\jest\bin\jest.js --runInBand --forceExit --runTestsByPath src\components\reference-video-controls.test.tsx src\screens\recording-review\recording-review.test.tsx src\screens\set-declaration\set-declaration.test.tsx src\features\capture\post-recording-route.test.tsx src\screens\exercise-selection\exercise-selection.test.tsx src\features\analysis\exercise-catalog.test.ts
```

Expected: all six suites pass.

- [ ] **Step 3: Run static checks**

```powershell
npm run typecheck
npm run lint
git diff --check
```

Expected: typecheck exits 0; lint has no errors; only the three pre-existing `purchases.native.test.ts` `require()` warnings may remain; diff check reports no whitespace errors.

- [ ] **Step 4: Review the exact diff and deployment boundary**

Confirm no unrelated files changed, no credentials appear in the diff, production database search is live, and native UI source remains local until a separate TestFlight submission. Do not commit, push, or submit a build unless the user explicitly requests it.
