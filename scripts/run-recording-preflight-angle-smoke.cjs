const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

require("dotenv").config({ path: path.resolve(".env.local") });
const { createClient } = require("@supabase/supabase-js");

const FRAME_COUNT = 24;
const DURATION_MS = 10_000;
const CASE_DIRECTORY = path.resolve("tmp/preflight-angle-benchmark/cases");

const cases = [
  {
    id: "curl_front",
    file: "curl_front.mp4",
    catalogExerciseId: 456,
    exerciseName: "Dumbbell Standing Curl",
    sourceKind: "real",
    expectedOutcome: "usable",
  },
  {
    id: "press_side",
    file: "press_side.mp4",
    catalogExerciseId: 48,
    exerciseName: "Standing Dumbbell Overhead Press",
    sourceKind: "real",
    expectedOutcome: "usable",
  },
  {
    id: "squat_diagonal",
    file: "squat_diagonal.mp4",
    catalogExerciseId: 12095,
    exerciseName: "Bodyweight Squat",
    sourceKind: "real",
    expectedOutcome: "usable",
  },
  {
    id: "squat_ground_up_simulated",
    file: "squat_ground_up_simulated.mp4",
    catalogExerciseId: 12095,
    exerciseName: "Bodyweight Squat",
    sourceKind: "simulated-perspective",
    expectedOutcome: "usable",
  },
  {
    id: "squat_ground_up_real",
    file: "squat_ground_up_real.mp4",
    catalogExerciseId: null,
    exerciseName: "Barbell Back Squat",
    sourceKind: "real-youtube",
    sourceUrl: "https://www.youtube.com/watch?v=a06n7KysFS8",
    sourceTitle: "Back squat form check",
    expectedOutcome: "usable",
  },
  {
    id: "triceps_seated_one_arm_front_real",
    file: "triceps_seated_one_arm_front_real.mp4",
    catalogExerciseId: null,
    exerciseName: "Seated Single-Arm Dumbbell Triceps Extension",
    sourceKind: "real-youtube",
    sourceUrl: "https://www.youtube.com/watch?v=kZ-ReOdn2qk",
    sourceTitle: "How to do a Seated Single-Arm Dumbbell Tricep Extension",
    expectedOutcome: "usable",
  },
  {
    id: "squat_critical_crop",
    file: "squat_critical_crop.mp4",
    catalogExerciseId: 12095,
    exerciseName: "Bodyweight Squat",
    sourceKind: "simulated-crop",
    expectedOutcome: "rerecord",
  },
  {
    id: "squat_too_far_simulated",
    file: "squat_too_far_simulated.mp4",
    catalogExerciseId: 12095,
    exerciseName: "Bodyweight Squat",
    sourceKind: "simulated-distance",
    expectedOutcome: "usable",
  },
  {
    id: "squat_too_small_simulated",
    file: "squat_too_small_simulated.mp4",
    catalogExerciseId: 12095,
    exerciseName: "Bodyweight Squat",
    sourceKind: "simulated-distance",
    expectedOutcome: "rerecord",
  },
  {
    id: "squat_ground_up_severe_simulated",
    file: "squat_ground_up_severe_simulated.mp4",
    catalogExerciseId: 12095,
    exerciseName: "Bodyweight Squat",
    sourceKind: "simulated-perspective",
    expectedOutcome: "rerecord",
  },
];

const requestedCaseIds = new Set(
  (process.env.PREFLIGHT_CASES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const selectedCases = requestedCaseIds.size > 0
  ? cases.filter((testCase) => requestedCaseIds.has(testCase.id))
  : cases;
if (selectedCases.length === 0) throw new Error("PREFLIGHT_CASES did not match a configured test case");

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function prepareFrames(videoPath, workingDirectory) {
  const outputPattern = path.join(workingDirectory, "frame-%03d.jpg");
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    videoPath,
    "-vf",
    "fps=2.4,scale=384:-2",
    "-frames:v",
    String(FRAME_COUNT),
    "-q:v",
    "5",
    outputPattern,
  ]);
  const files = fs.readdirSync(workingDirectory)
    .filter((name) => /^frame-\d+\.jpg$/.test(name))
    .sort();
  if (files.length !== FRAME_COUNT) {
    throw new Error(`Expected ${FRAME_COUNT} frames from ${path.basename(videoPath)}, received ${files.length}`);
  }
  return files.map((name, index) => ({
    timeMs: Math.round(DURATION_MS * ((index + 0.5) / FRAME_COUNT)),
    mimeType: "image/jpeg",
    data: fs.readFileSync(path.join(workingDirectory, name)).toString("base64"),
  }));
}

async function main() {
  const supabaseUrl = requireEnvironment("EXPO_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const anonKey = requireEnvironment("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `preflight-angle-${Date.now()}-${crypto.randomUUID()}@example.invalid`;
  const password = crypto.randomBytes(24).toString("base64url");
  let userId = null;
  const workingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "formie-preflight-angle-"));

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("Temporary test user was not created");
    userId = created.data.user.id;
    const signedIn = await anon.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session?.access_token) {
      throw signedIn.error ?? new Error("Temporary test session was not created");
    }

    const results = [];
    for (const testCase of selectedCases) {
      const caseDirectory = path.join(workingRoot, testCase.id);
      fs.mkdirSync(caseDirectory, { recursive: true });
      const frames = prepareFrames(path.join(CASE_DIRECTORY, testCase.file), caseDirectory);
      const startedAt = Date.now();
      const response = await fetch(`${supabaseUrl}/functions/v1/recording-preflight`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${signedIn.data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          frames,
          durationMs: DURATION_MS,
          exerciseName: testCase.exerciseName,
          catalogExerciseId: testCase.catalogExerciseId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      results.push({
        id: testCase.id,
        sourceKind: testCase.sourceKind,
        sourceUrl: testCase.sourceUrl ?? null,
        sourceTitle: testCase.sourceTitle ?? null,
        status: response.status,
        expectedOutcome: testCase.expectedOutcome,
        passed: response.status === 200 && payload.outcome === testCase.expectedOutcome,
        latencyMs: Date.now() - startedAt,
        outcome: payload.outcome ?? null,
        reason: payload.reason ?? payload.message ?? null,
        visibility: payload.checks?.visibility ?? null,
        cameraQuality: payload.checks?.cameraQuality ?? null,
        cameraLimitations: payload.checks?.cameraLimitations ?? null,
        movementEvidence: payload.checks?.movementEvidence ?? null,
        requiredBodyRegions: payload.checks?.visibilityRequirements?.bodyRegions ?? null,
        missingRequirements: payload.checks?.missingRequirements ?? null,
        perspectiveDistortedRequirements: payload.checks?.perspectiveDistortedRequirements ?? null,
        activeMovementFrameIndices: payload.checks?.activeMovementFrameIndices ?? null,
        requirementEvidence: payload.checks?.requirementEvidence ?? null,
        guidance: payload.guidance ?? null,
      });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      deployedEndpoint: `${supabaseUrl}/functions/v1/recording-preflight`,
      note: "The real-youtube cases use physically recorded camera views. The cases labeled simulated-perspective or simulated-distance remain synthetic stress transforms.",
      results,
    };
    const reportPath = path.resolve(
      "tmp/preflight-angle-benchmark",
      `live-results-${new Date().toISOString().replaceAll(":", "-")}.json`,
    );
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ reportPath, ...report }, null, 2)}\n`);
    if (results.some((result) => !result.passed)) process.exitCode = 1;
  } finally {
    fs.rmSync(workingRoot, { recursive: true, force: true });
    if (userId) {
      const deleted = await admin.auth.admin.deleteUser(userId);
      if (deleted.error) process.stderr.write(`Temporary user cleanup failed: ${deleted.error.message}\n`);
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
