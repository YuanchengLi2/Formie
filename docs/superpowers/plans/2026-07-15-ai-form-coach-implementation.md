# AI Form Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in one agent. Steps use checkbox (`- [ ]`) syntax for tracking. The repository instruction forbids subagents.

**Goal:** Build the FORM Expo app and analysis services so users can record any of 50 exercises, have Gemini analyze the actual video with dense pose evidence, and receive a score plus concise, AI-selected corrections.

**Architecture:** An Expo Router mobile client records and privately uploads video to Supabase. Supabase owns identity, storage, job state, and validated results; a Python worker performs dense pose/evidence extraction and invokes Gemini with the original MP4, exercise context, and evidence frames. The client displays only validated score, problem, and improvement content.

**Tech Stack:** Expo SDK 55+, React Native, TypeScript, Expo Router, Expo Camera, Expo Video, TanStack Query, Supabase, Deno Edge Functions, Python 3.12, FastAPI, FFmpeg, OpenCV, MediaPipe, Google Gemini, Vitest, React Native Testing Library, Pytest.

## Global Constraints

- Support iOS and Android from one Expo codebase.
- Include the 50 exercises enumerated in the approved design.
- The original video must be uploaded to Gemini; pose coordinates alone are insufficient.
- Extract pose at 15 FPS and preserve full-resolution evidence frames around phase transitions.
- Results expose only score, what went wrong, what to improve, and retry/record-another actions.
- AI observations are open-ended; exercise profile faults are context examples, never an answer whitelist.
- Display no issue below `0.75` confidence or when required visual evidence is unavailable.
- Keep `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Follow the supplied matte-black, charcoal, white, and warm-gold visual references.
- Use no subagents.

---

## File Map

### Mobile

- `src/app/`: routes only.
- `src/screens/`: Home, exercise, capture, analysis, results, progress, and profile screen bodies.
- `src/components/`: reusable premium UI primitives.
- `src/features/exercises/`: catalog, profile types, search, and selection.
- `src/features/analysis/`: result types, validation, upload/polling API, and hooks.
- `src/features/capture/`: camera permissions and recording state.
- `src/lib/`: Supabase client and query client.
- `src/theme/`: immutable FORM tokens.

### Supabase

- `supabase/migrations/`: schema, indexes, storage policies, and RLS.
- `supabase/functions/create-analysis/`: creates an owned session and signed upload target.
- `supabase/functions/complete-upload/`: verifies the uploaded object and queues analysis.
- `supabase/functions/analysis-status/`: returns an owned validated result.
- `supabase/functions/_shared/`: authentication, responses, and job helpers.

### Worker

- `worker/app/`: FastAPI entrypoint, config, job lease, storage, media, pose, evidence, Gemini, validation, and orchestration modules.
- `worker/tests/`: unit and integration tests with synthetic landmark fixtures and a fake Gemini adapter.

---

### Task 1: Scaffold the Expo App and Test Harness

**Files:**
- Create: `package.json`
- Create: `app.json`
- Create: `babel.config.js`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/app/_layout.tsx`
- Create: `src/app/index.tsx`
- Create: `src/test/setup.ts`
- Create: `.env.example`

**Interfaces:**
- Produces: Expo Router entrypoint, `@/* -> src/*` alias, Vitest environment, and named environment variables.

- [ ] **Step 1: Create the Expo project manifest and install dependencies**

Use Expo SDK 55-compatible package versions selected by `npx expo install`; include `expo-router`, `expo-camera`, `expo-video`, `expo-image`, `expo-haptics`, `expo-secure-store`, `react-native-reanimated`, `react-native-safe-area-context`, `@tanstack/react-query`, `@supabase/supabase-js`, `zod`, `zustand`, `vitest`, `@testing-library/react-native`, and `react-test-renderer`.

Run:

```powershell
npx create-expo-app@latest . --template blank-typescript
npx expo install expo-router expo-camera expo-video expo-image expo-haptics expo-secure-store react-native-reanimated react-native-safe-area-context
npm install @tanstack/react-query @supabase/supabase-js zod zustand
npm install --save-dev vitest @testing-library/react-native react-test-renderer
```

Expected: dependencies install with exit code 0 and `npx expo install --check` reports no invalid versions.

- [ ] **Step 2: Configure routes, aliases, tests, and environment names**

`tsconfig.json` must include:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

`.env.example` must contain variable names without values:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 3: Verify the generated baseline**

Run:

```powershell
npx tsc --noEmit
npx expo export --platform web
npm test -- --run
```

Expected: all commands exit 0; Vitest reports zero failed tests.

- [ ] **Step 4: Commit the scaffold**

```powershell
git add package.json package-lock.json app.json babel.config.js tsconfig.json vitest.config.ts src .env.example
git commit -m "chore: scaffold FORM mobile app"
```

### Task 2: Build the Exercise Catalog and Open-Ended Profiles

**Files:**
- Create: `src/features/exercises/types.ts`
- Create: `src/features/exercises/catalog.ts`
- Create: `src/features/exercises/catalog.test.ts`
- Create: `src/features/exercises/search.ts`
- Create: `src/features/exercises/search.test.ts`
- Create: `src/features/exercises/profile-schema.ts`
- Create: `src/features/exercises/profile-schema.test.ts`

**Interfaces:**
- Produces: `Exercise`, `ExerciseProfile`, `EXERCISES`, `findExercise(slug)`, `searchExercises(query, category)`, and `exerciseProfileSchema`.
- Profile contract: `commonFaults` is advisory context and has no exhaustive/whitelist flag.

- [ ] **Step 1: Write failing catalog tests**

```ts
import { EXERCISES, findExercise } from "./catalog";

describe("exercise catalog", () => {
  it("contains exactly 50 unique launch exercises", () => {
    expect(EXERCISES).toHaveLength(50);
    expect(new Set(EXERCISES.map((exercise) => exercise.slug)).size).toBe(50);
  });

  it("keeps common faults as non-exclusive AI context", () => {
    const curl = findExercise("standing-dumbbell-curl");
    expect(curl?.profile.analysisInstruction).toContain("not an exhaustive list");
  });
});
```

- [ ] **Step 2: Run the catalog tests and confirm RED**

Run: `npm test -- --run src/features/exercises/catalog.test.ts`

Expected: FAIL because `./catalog` does not exist.

- [ ] **Step 3: Implement types and all 50 exercise records**

Use this public shape:

```ts
export type ExerciseProfile = {
  camera: {
    preferredView: "front" | "side" | "rear" | "front-45" | "rear-45";
    alternatives: string[];
    requiredLandmarks: string[];
    distanceMeters: [number, number];
  };
  phases: string[];
  attentionAreas: string[];
  commonFaults: Array<{ observation: string; whyItMatters: string; cue: string }>;
  analysisInstruction: string;
};

export type Exercise = {
  id: number;
  slug: string;
  name: string;
  category: "Chest" | "Back" | "Legs" | "Shoulders" | "Arms" | "Core";
  equipment: string[];
  aliases: string[];
  profile: ExerciseProfile;
};
```

Every profile's `analysisInstruction` must say: `Use these checks as attention guidance, not an exhaustive list. Analyze the complete video and report any visible, evidence-backed technique issue.`

- [ ] **Step 4: Run catalog tests and confirm GREEN**

Run: `npm test -- --run src/features/exercises/catalog.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Write failing search tests**

```ts
import { searchExercises } from "./search";

it("searches names and aliases without case sensitivity", () => {
  expect(searchExercises("RDL").map((item) => item.slug)).toContain("romanian-deadlift");
});

it("filters by category", () => {
  expect(searchExercises("", "Arms").every((item) => item.category === "Arms")).toBe(true);
});
```

- [ ] **Step 6: Run search tests, implement normalized search, and rerun**

Run RED: `npm test -- --run src/features/exercises/search.test.ts`

Implement:

```ts
import { EXERCISES } from "./catalog";
import type { Exercise } from "./types";

export function searchExercises(query: string, category?: Exercise["category"]): Exercise[] {
  const normalized = query.trim().toLocaleLowerCase();
  return EXERCISES.filter((exercise) => {
    const inCategory = !category || exercise.category === category;
    const terms = [exercise.name, exercise.slug, ...exercise.aliases].join(" ").toLocaleLowerCase();
    return inCategory && (!normalized || terms.includes(normalized));
  });
}
```

Run GREEN: `npm test -- --run src/features/exercises/search.test.ts`

- [ ] **Step 7: Commit catalog and search**

```powershell
git add src/features/exercises
git commit -m "feat: add 50 exercise analysis profiles"
```

### Task 3: Define and Validate AI Results

**Files:**
- Create: `src/features/analysis/types.ts`
- Create: `src/features/analysis/result-schema.ts`
- Create: `src/features/analysis/result-schema.test.ts`
- Create: `src/features/analysis/presentation.ts`
- Create: `src/features/analysis/presentation.test.ts`

**Interfaces:**
- Produces: `analysisResultSchema`, `AnalysisResult`, `getVisibleIssues(result)`, and `getResultPresentation(result)`.

- [ ] **Step 1: Write failing confidence/evidence tests**

```ts
import { analysisResultSchema } from "./result-schema";

it("rejects an issue without timestamped visual evidence", () => {
  const parsed = analysisResultSchema.safeParse({
    status: "complete",
    score: 82,
    scoreRationale: [],
    issues: [{
      title: "Elbow drift",
      whatWentWrong: "Your elbow moved forward during rep 3.",
      whatToImprove: "Keep the elbow stacked under the shoulder.",
      startMs: 0,
      endMs: 0,
      repNumber: 3,
      visualEvidence: "",
      poseEvidence: null,
      severity: "medium",
      confidence: 0.84,
      observableLandmarks: ["left_elbow"]
    }],
    noMajorIssueSummary: null,
    nextRefinement: null,
    retryInstruction: null
  });
  expect(parsed.success).toBe(false);
});
```

- [ ] **Step 2: Run schema test and confirm RED**

Run: `npm test -- --run src/features/analysis/result-schema.test.ts`

Expected: FAIL because the schema is absent.

- [ ] **Step 3: Implement the strict Zod schema**

Implement the approved `AnalysisResult` fields, require `endMs > startMs`, bound score to `0..100`, bound confidence to `0..1`, cap issues at three, and refine `complete` results so they contain a score and either supported issues or `noMajorIssueSummary`.

- [ ] **Step 4: Run schema tests and confirm GREEN**

Run: `npm test -- --run src/features/analysis/result-schema.test.ts`

Expected: all schema tests pass.

- [ ] **Step 5: Write failing presentation tests**

```ts
import { getVisibleIssues } from "./presentation";

it("shows only evidence-backed issues at or above 0.75 confidence", () => {
  const issues = getVisibleIssues({ issues: [
    { id: "high", confidence: 0.91, visualEvidence: "Visible at 00:08", startMs: 8000, endMs: 8500 },
    { id: "low", confidence: 0.74, visualEvidence: "Visible at 00:09", startMs: 9000, endMs: 9500 }
  ] } as never);
  expect(issues.map((issue) => issue.id)).toEqual(["high"]);
});
```

- [ ] **Step 6: Implement presentation gating and rerun**

`getVisibleIssues` must filter `confidence >= 0.75`, non-empty `visualEvidence`, and `endMs > startMs`, then sort high severity before medium before low.

Run: `npm test -- --run src/features/analysis/presentation.test.ts`

Expected: all presentation tests pass.

- [ ] **Step 7: Commit result contracts**

```powershell
git add src/features/analysis
git commit -m "feat: validate evidence-backed AI results"
```

### Task 4: Build the FORM Visual System and Navigation Shell

**Files:**
- Create: `src/theme/colors.ts`
- Create: `src/theme/spacing.ts`
- Create: `src/theme/type.ts`
- Create: `src/components/form-button.tsx`
- Create: `src/components/form-card.tsx`
- Create: `src/components/form-wordmark.tsx`
- Create: `src/components/score-ring.tsx`
- Create: `src/components/form-button.test.tsx`
- Modify: `src/app/_layout.tsx`
- Create: `src/app/(tabs)/_layout.tsx`
- Create: `src/app/(tabs)/(home)/_layout.tsx`
- Create: `src/app/(tabs)/(home)/index.tsx`
- Create: `src/app/(tabs)/(progress)/_layout.tsx`
- Create: `src/app/(tabs)/(progress)/index.tsx`
- Create: `src/app/(tabs)/(profile)/_layout.tsx`
- Create: `src/app/(tabs)/(profile)/index.tsx`

**Interfaces:**
- Produces: stable FORM tokens and three native bottom tabs.

- [ ] **Step 1: Write a failing button behavior test**

```tsx
import { fireEvent, render } from "@testing-library/react-native";
import { FormButton } from "./form-button";

it("invokes the primary action once", () => {
  const onPress = vi.fn();
  const view = render(<FormButton label="Record Set" onPress={onPress} />);
  fireEvent.press(view.getByText("Record Set"));
  expect(onPress).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the component test and confirm RED**

Run: `npm test -- --run src/components/form-button.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement tokens and primitives**

Use `#090909` background, `#141414` surfaces, `#262626` borders, `#FFFFFF` primary text, `#A6A6A6` secondary text, and `#D8B45A` gold. Buttons use 56px height, 16px continuous corners, black text on gold, and reduced opacity while disabled.

- [ ] **Step 4: Implement NativeTabs and stacks**

Use `NativeTabs` from `expo-router/unstable-native-tabs` with Home (`house`), Progress (`chart.bar`), and Profile (`person`) triggers. Nest a `Stack` inside each tab group. Camera routes are outside the tab group with hidden headers.

- [ ] **Step 5: Run UI test, typecheck, and export**

```powershell
npm test -- --run src/components/form-button.test.tsx
npx tsc --noEmit
npx expo export --platform web
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit the shell**

```powershell
git add src/theme src/components src/app
git commit -m "feat: build premium FORM app shell"
```

### Task 5: Implement Exercise Discovery and Selection

**Files:**
- Create: `src/screens/home/index.tsx`
- Create: `src/screens/home/exercise-row.tsx`
- Create: `src/screens/exercise-search/index.tsx`
- Create: `src/screens/exercise-detail/index.tsx`
- Create: `src/screens/exercise-search/exercise-search.test.tsx`
- Create: `src/app/exercises/index.tsx`
- Create: `src/app/exercises/[slug].tsx`

**Interfaces:**
- Consumes: `EXERCISES`, `searchExercises`, `findExercise`.
- Produces: navigation from Home to search to `/exercises/[slug]` to `/capture/setup?exercise=<slug>`.

- [ ] **Step 1: Write failing discovery tests**

Render the search screen, type `curl`, and assert that Standing Dumbbell Curl, Hammer Curl, Barbell Curl, Cable Curl, and Preacher Curl appear. Press a result and assert the route target contains its slug.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- --run src/screens/exercise-search/exercise-search.test.tsx`

Expected: FAIL because screen modules are absent.

- [ ] **Step 3: Implement Home, search, and confirmation screens**

Match the reference hierarchy: FORM wordmark, `Ready to improve today?`, search surface, category chips, recent cards, monochrome glyphs, and a gold confirmation action. Use `FlatList`/`ScrollView` with automatic content insets and dark surfaces.

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `npm test -- --run src/screens/exercise-search/exercise-search.test.tsx`

Expected: discovery tests pass.

- [ ] **Step 5: Commit discovery flow**

```powershell
git add src/screens/home src/screens/exercise-search src/screens/exercise-detail src/app/exercises
git commit -m "feat: add exercise discovery flow"
```

### Task 6: Add Supabase Schema, Security, and Client Access

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202607150001_form_schema.sql`
- Create: `supabase/tests/rls.sql`
- Create: `src/lib/supabase.ts`
- Create: `src/lib/query-client.ts`
- Create: `src/features/analysis/api.ts`
- Create: `src/features/analysis/api.test.ts`

**Interfaces:**
- Produces: `createAnalysisSession(exerciseId)`, `uploadAnalysisVideo(target, uri)`, `completeAnalysisUpload(sessionId)`, and `getAnalysisStatus(sessionId)`.

- [ ] **Step 1: Write failing API contract tests with an injected fetch function**

Assert that `createAnalysisSession` sends the user's bearer token, exercise ID, and JSON content type; non-2xx responses must throw `AnalysisApiError` with response status and code.

- [ ] **Step 2: Run API tests and confirm RED**

Run: `npm test -- --run src/features/analysis/api.test.ts`

Expected: FAIL because the API module is absent.

- [ ] **Step 3: Implement database tables and RLS**

Create `exercises`, `exercise_profiles`, `analysis_sessions`, `analysis_jobs`, `analysis_results`, and `pose_artifacts`. Policies must use `auth.uid() = user_id` directly or through the owning session. Add a private `analysis-videos` bucket and owner-scoped object policies using the first path segment as user ID.

- [ ] **Step 4: Implement typed client and resilient API wrapper**

Use `@supabase/supabase-js` with `expo-secure-store` session storage. Use `fetch`, explicit status checks, parsed error bodies, and `AbortSignal`; do not use Axios.

- [ ] **Step 5: Run API tests and SQL policy tests**

```powershell
npm test -- --run src/features/analysis/api.test.ts
npx supabase db start
npx supabase test db
```

Expected: API tests and database policy tests pass.

- [ ] **Step 6: Commit database and client**

```powershell
git add supabase src/lib src/features/analysis/api.ts src/features/analysis/api.test.ts
git commit -m "feat: secure analysis data with Supabase"
```

### Task 7: Build Camera Setup, Recording, and Upload

**Files:**
- Create: `src/features/capture/recording-machine.ts`
- Create: `src/features/capture/recording-machine.test.ts`
- Create: `src/features/capture/use-recording.ts`
- Create: `src/screens/camera-setup/index.tsx`
- Create: `src/screens/record-set/index.tsx`
- Create: `src/screens/analysis-progress/index.tsx`
- Create: `src/app/capture/setup.tsx`
- Create: `src/app/capture/record.tsx`
- Create: `src/app/analysis/[session-id].tsx`

**Interfaces:**
- Produces: deterministic capture states `permission -> ready -> countdown -> recording -> stopped -> uploading -> queued | failed`.

- [ ] **Step 1: Write failing state-machine tests**

Test that recording cannot begin before permission and readiness, stop returns the recorded URI, upload failure retains the local URI, and retry resumes from `stopped` rather than discarding the set.

- [ ] **Step 2: Run state-machine tests and confirm RED**

Run: `npm test -- --run src/features/capture/recording-machine.test.ts`

Expected: FAIL because the machine is absent.

- [ ] **Step 3: Implement the minimal state machine and hook**

Use a pure reducer for transitions and a hook for `CameraView` effects. Record `mp4` with a 60-second maximum, keep the URI until upload succeeds, and request camera permission before rendering setup.

- [ ] **Step 4: Implement reference-faithful camera screens**

Setup shows preferred view, full-body framing, distance, and one gold action. Recording hides headers, uses a real ten-second countdown, shows timer and stop control, and transitions to analysis only after successful queueing.

- [ ] **Step 5: Run tests, typecheck, and Expo Go smoke test**

```powershell
npm test -- --run src/features/capture/recording-machine.test.ts
npx tsc --noEmit
npx expo start
```

Expected: tests/typecheck pass and the app opens in Expo Go with camera permission flow available.

- [ ] **Step 6: Commit capture flow**

```powershell
git add src/features/capture src/screens/camera-setup src/screens/record-set src/screens/analysis-progress src/app/capture src/app/analysis
git commit -m "feat: record and upload exercise sets"
```

### Task 8: Create Supabase Analysis Functions and Direct Gemini Video Input

**Files:**
- Create: `supabase/functions/_shared/auth.ts`
- Create: `supabase/functions/_shared/http.ts`
- Create: `supabase/functions/_shared/gemini.ts`
- Create: `supabase/functions/create-analysis/index.ts`
- Create: `supabase/functions/complete-upload/index.ts`
- Create: `supabase/functions/analysis-status/index.ts`
- Create: `supabase/functions/tests/gemini.test.ts`
- Create: `supabase/functions/tests/create-analysis.test.ts`

**Interfaces:**
- Produces: authenticated create/complete/status endpoints and `uploadVideoToGemini(bytes, mimeType) -> GeminiFileReference`.

- [ ] **Step 1: Write failing Gemini adapter tests**

Assert that the adapter starts a resumable Gemini Files upload, writes the original MP4 bytes, polls until `ACTIVE`, and creates a request whose first input item is `{ type: "video", uri, mime_type }`.

- [ ] **Step 2: Run Deno tests and confirm RED**

Run: `deno test --allow-env supabase/functions/tests/gemini.test.ts`

Expected: FAIL because the adapter is absent.

- [ ] **Step 3: Implement authenticated create and upload-complete functions**

`create-analysis` validates the exercise, creates an owned session, and returns a signed upload path. `complete-upload` verifies ownership and storage metadata, creates exactly one queued job, and never returns a service secret.

- [ ] **Step 4: Implement actual Gemini Files upload adapter**

Read `GEMINI_API_KEY` only inside the function/worker environment. Send original bytes without transcoding them into text or pose summaries. Delete the Gemini file after the final analysis or retention timeout.

- [ ] **Step 5: Run Deno tests and local function integration**

```powershell
deno test --allow-env supabase/functions/tests
npx supabase functions serve --env-file .env.local
```

Expected: Deno tests pass and authenticated local calls create owned sessions without revealing secrets.

- [ ] **Step 6: Commit edge functions**

```powershell
git add supabase/functions
git commit -m "feat: queue original videos for Gemini analysis"
```

### Task 9: Implement Dense Pose and Evidence Worker

**Files:**
- Create: `worker/pyproject.toml`
- Create: `worker/Dockerfile`
- Create: `worker/app/config.py`
- Create: `worker/app/models.py`
- Create: `worker/app/media.py`
- Create: `worker/app/pose.py`
- Create: `worker/app/repetitions.py`
- Create: `worker/app/evidence.py`
- Create: `worker/app/gemini.py`
- Create: `worker/app/verifier.py`
- Create: `worker/app/orchestrator.py`
- Create: `worker/app/main.py`
- Create: `worker/tests/test_pose.py`
- Create: `worker/tests/test_repetitions.py`
- Create: `worker/tests/test_evidence.py`
- Create: `worker/tests/test_verifier.py`
- Create: `worker/tests/test_orchestrator.py`

**Interfaces:**
- Produces: `analyze_session(session_id: UUID) -> AnalysisResult`, `extract_pose(video_path, sample_fps=15)`, `segment_repetitions(frames, profile)`, `select_evidence(...)`, and `verify_result(...)`.

- [ ] **Step 1: Write failing pose sampling test**

```py
def test_sample_timestamps_are_15_fps_for_two_seconds():
    timestamps = build_sample_timestamps(duration_ms=2000, sample_fps=15)
    assert len(timestamps) == 30
    assert timestamps[0] == 0
    assert timestamps[-1] < 2000
```

- [ ] **Step 2: Run Pytest and confirm RED**

Run: `python -m pytest worker/tests/test_pose.py -q`

Expected: FAIL because `build_sample_timestamps` is absent.

- [ ] **Step 3: Implement media validation and 15-FPS pose extraction**

FFprobe must reject duration outside 3–60 seconds, resolution below 720 pixels on the long edge, and unusable frame rate. MediaPipe output retains per-landmark visibility and never interpolates across an occlusion longer than 200ms.

- [ ] **Step 4: Write failing repetition and evidence tests**

Use synthetic sinusoidal joint motion to assert two complete repetitions, phase boundaries, and selection of full-resolution frames on both sides of each transition.

- [ ] **Step 5: Implement segmentation and evidence selection**

Smooth only short noise with a Savitzky-Golay filter, use exercise profile attention areas to select primary trajectories, and retain global/full-body plus detail crops. Selection is not limited to known common faults.

- [ ] **Step 6: Write failing verifier tests**

Test suppression for confidence `0.74`, missing visual evidence, non-visible required landmark, zero-length timestamp, medical diagnosis language, and contradiction between pose direction and text observation.

- [ ] **Step 7: Implement Gemini orchestration and verifier**

Provide the original Gemini video reference, profile attention guidance, pose summary, phase-aligned evidence images, and strict JSON schema. The prompt explicitly permits novel visible issues and forbids inventing feedback to fill the result.

- [ ] **Step 8: Run worker tests and container build**

```powershell
python -m pytest worker/tests -q
docker build -t form-analysis-worker worker
```

Expected: all Pytest tests pass and Docker build exits 0.

- [ ] **Step 9: Commit worker**

```powershell
git add worker
git commit -m "feat: analyze video with dense pose evidence"
```

### Task 10: Render Analysis, Results, Progress, and Failure States

**Files:**
- Create: `src/features/analysis/hooks.ts`
- Create: `src/screens/results/index.tsx`
- Create: `src/screens/results/issue-card.tsx`
- Create: `src/screens/results/results.test.tsx`
- Create: `src/screens/unable-to-analyze/index.tsx`
- Create: `src/screens/progress/index.tsx`
- Create: `src/app/results/[session-id].tsx`
- Create: `src/app/results/[session-id]/unable.tsx`
- Modify: `src/app/(tabs)/(progress)/index.tsx`

**Interfaces:**
- Consumes: `getAnalysisStatus`, `analysisResultSchema`, `getResultPresentation`.
- Produces: simplified result UI and session history.

- [ ] **Step 1: Write failing results tests**

Assert that a complete result renders the score, `What went wrong`, and `What to improve`; internal rationale and fixed metrics are absent; zero supported issues renders `No major form issue detected in the visible set`; unable status renders one retry instruction.

- [ ] **Step 2: Run results tests and confirm RED**

Run: `npm test -- --run src/screens/results/results.test.tsx`

Expected: FAIL because the results screen is absent.

- [ ] **Step 3: Implement polling and simplified results**

Use TanStack Query with two-second polling only while status is queued/processing, stop on terminal state, validate every server payload with Zod, and navigate partial/unable results to the correct presentation.

- [ ] **Step 4: Implement progress from completed sessions**

Render score history and recent sessions. A metric trend is omitted until at least three comparable observations exist for the same exercise/profile version.

- [ ] **Step 5: Run tests and export**

```powershell
npm test -- --run src/screens/results/results.test.tsx
npx tsc --noEmit
npx expo export --platform web
```

Expected: tests, typecheck, and export pass.

- [ ] **Step 6: Commit presentation flow**

```powershell
git add src/features/analysis/hooks.ts src/screens/results src/screens/unable-to-analyze src/screens/progress src/app/results src/app/(tabs)/(progress)/index.tsx
git commit -m "feat: present concise AI coaching results"
```

### Task 11: End-to-End Security, Evaluation, and Release Verification

**Files:**
- Create: `tests/e2e/analysis-flow.test.ts`
- Create: `tests/contracts/mobile-bundle-secrets.test.ts`
- Create: `evaluation/manifest.schema.json`
- Create: `evaluation/README.md`
- Create: `scripts/verify-analysis-contract.mjs`
- Modify: `README.md`

**Interfaces:**
- Produces: repeatable proof of original-video transmission, secret isolation, evidence gating, all-50 profile coverage, and app build health.

- [ ] **Step 1: Write contract tests**

Test that all 50 profiles validate, the mobile bundle contains neither server secret variable name nor current secret values, the Gemini request contains a video item, and the result endpoint never returns score rationale or raw model output to unauthorized users.

- [ ] **Step 2: Run contract tests and confirm RED**

Run: `npm test -- --run tests/contracts`

Expected: FAIL until build inspection and request capture helpers are implemented.

- [ ] **Step 3: Implement verification scripts and evaluation manifest**

The manifest schema requires exercise slug, consented clip path, expected visible issues, non-observable criteria, rep boundaries, camera angle, and coach rating. `verify-analysis-contract.mjs` captures a fake-worker Gemini request and asserts `input[0].type === "video"`.

- [ ] **Step 4: Run full verification**

```powershell
npm test -- --run
npx tsc --noEmit
npx expo install --check
npx expo export --platform web
python -m pytest worker/tests -q
deno test --allow-env supabase/functions/tests
npx supabase test db
node scripts/verify-analysis-contract.mjs
git diff --check
```

Expected: every command exits 0 and reports zero failed tests.

- [ ] **Step 5: Run a device smoke test**

Start Expo Go, select Standing Dumbbell Curl, record a short set, confirm a private upload is created, verify the job stages advance from real backend state, inspect the captured Gemini request for the original video item, and confirm the results screen displays only score/problem/improvement.

- [ ] **Step 6: Commit verification assets and documentation**

```powershell
git add tests evaluation scripts README.md
git commit -m "test: verify FORM analysis end to end"
```

