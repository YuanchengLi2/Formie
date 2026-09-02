import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (root, path) => readFileSync(`${root}/${path}`, "utf8");
const requireMatch = (failures, source, pattern, message) => { if (!pattern.test(source)) failures.push(message); };
const forbidMatch = (failures, source, pattern, message) => { if (pattern.test(source)) failures.push(message); };

export function auditIosReleaseSurfaces(appConfig, releaseGates) {
  const failures = [];
  if (appConfig.ios?.supportsTablet !== false || releaseGates.iphoneOnly !== true) {
    failures.push("Expo iOS configuration must remain iPhone-only for Formie 1.0");
  }
  if (releaseGates.appStoreAvailability?.appleSiliconMac !== false) {
    failures.push("Apple silicon Mac availability must be disabled for Formie 1.0");
  }
  if (releaseGates.appStoreAvailability?.appleVisionPro !== false) {
    failures.push("Apple Vision Pro availability must be disabled for Formie 1.0");
  }
  if (!releaseGates.physicalAcceptance?.includes("ipad_iphone_compatibility")) {
    failures.push("iPad iPhone-compatibility acceptance is missing");
  }
  return failures;
}

const APPROVED_SCREENSHOT_ORDER = [
  "01-benefits-overview.png",
  "02-record-a-set.png",
  "03-analysis-in-progress.png",
  "04-evidence-linked-correction.png",
  "05-progress-and-next-set.png",
];

export function auditScreenshotReleasePlan(releaseGates) {
  const failures = [];
  if (releaseGates.screenshotCanvas?.width !== 1290 || releaseGates.screenshotCanvas?.height !== 2796) {
    failures.push("Final 6.9-inch screenshots must use a 1290x2796 canvas");
  }
  if (releaseGates.firstScreenshotComposition !== "angled_phone_benefits") {
    failures.push("The leftmost screenshot must be the angled-phone benefits composition");
  }
  if (JSON.stringify(releaseGates.screenshotOrder) !== JSON.stringify(APPROVED_SCREENSHOT_ORDER)) {
    failures.push("Final screenshots are not in the approved benefits-to-next-set narrative order");
  }
  return failures;
}

export function auditAppStorePolicy(root = process.cwd()) {
  const failures = [];
  const app = read(root, "app.json");
  const appConfig = JSON.parse(app).expo;
  const store = JSON.parse(read(root, "store.config.json"));
  const env = read(root, ".env.example");
  const onboarding = read(root, "src/features/onboarding/onboarding-schema.ts");
  const consentMigration = read(root, "supabase/migrations/202608310001_adult_ai_consent.sql");
  const externalDeletionMigration = read(root, "supabase/migrations/202608310002_apple_authorizations_and_external_deletions.sql");
  const appleAuthEvents = read(root, "supabase/functions/apple-auth-events/index.ts");
  const guideIndex = read(root, "supabase/functions/exercise-guide/index.ts");
  const youtubeTutorial = read(root, "supabase/functions/_shared/youtube-tutorial.ts");
  const youtubeCacheMigration = read(root, "supabase/migrations/202608310003_youtube_tutorial_cache.sql");
  const geminiGovernance = read(root, "supabase/functions/_shared/gemini-governance.ts");
  const geminiGenerate = read(root, "supabase/functions/_shared/gemini-generate.ts");
  const geminiFiles = read(root, "supabase/functions/_shared/gemini-files.ts");
  const paywall = read(root, "src/screens/onboarding/premium-screen.tsx");
  const coach = read(root, "src/screens/coach/coach-preview.tsx");
  const profileProvider = read(root, "src/features/profile/profile-provider.tsx");
  const websiteVisuals = read(root, "website/components/app-visuals.tsx");
  const privacyLabels = JSON.parse(read(root, "docs/app-store/privacy-labels.json"));
  const releaseGates = JSON.parse(read(root, "docs/app-store/1.0-release-gates.json"));

  failures.push(...auditIosReleaseSurfaces(appConfig, releaseGates));
  failures.push(...auditScreenshotReleasePlan(releaseGates));

  requireMatch(failures, app, /"usesAppleSignIn"\s*:\s*true/, "Native Sign in with Apple is not enabled");
  requireMatch(failures, app, /expo-apple-authentication/, "Apple authentication plugin is missing");
  forbidMatch(failures, JSON.stringify({ infoPlist: appConfig.ios?.infoPlist, permissions: appConfig.android?.permissions }), /NSMicrophoneUsageDescription|RECORD_AUDIO|MODIFY_AUDIO_SETTINGS/, "Active audio permissions remain in app.json");
  requireMatch(failures, JSON.stringify(appConfig.android?.blockedPermissions), /RECORD_AUDIO.*MODIFY_AUDIO_SETTINGS/, "Android audio permissions are not explicitly blocked");
  requireMatch(failures, app, /"recordAudioAndroid"\s*:\s*false/, "Android camera audio recording is not disabled");
  requireMatch(failures, onboarding, /min\(18/, "Onboarding age is not 18+");
  requireMatch(failures, consentMigration, /record_ai_processing_consent|revoke_ai_processing_consent|AI_CONSENT_REVOKED/, "Versioned AI consent migration is incomplete");
  requireMatch(failures, externalDeletionMigration, /resolve_apple_identity_user_id[\s\S]*from auth\.identities[\s\S]*grant execute[\s\S]*service_role/, "Legacy Apple identities cannot be resolved securely for server account-deletion events");
  requireMatch(failures, appleAuthEvents, /rpc\("resolve_apple_identity_user_id"[\s\S]*data\?\.user_id \?\? resolvedUserId/, "Apple server account-deletion events do not fall back to legacy identity resolution");
  requireMatch(failures, guideIndex, /YOUTUBE_DATA_API_KEY|createYouTubeTutorialClient/, "Tutorials are not using the YouTube Data API");
  forbidMatch(failures, guideIndex, /GeminiTutorial|GEMINI_TUTORIAL_MODEL/, "Gemini still selects tutorial URLs");
  requireMatch(failures, youtubeTutorial, /MIN_TUTORIAL_DURATION_SECONDS\s*=\s*181/, "YouTube eligibility does not fail closed against three-minute Shorts");
  requireMatch(failures, youtubeCacheMigration, /form-youtube-tutorial-cache-expiry[\s\S]*delete from public\.youtube_tutorial_cache where expires_at <= now\(\)/, "YouTube cache has no traffic-independent 30-day expiry job");
  forbidMatch(failures, profileProvider, /sync-acquisition-sheet/, "Google Sheets export remains enabled");
  requireMatch(failures, paywall, /\{price\} per month|10 analyses per month/, "Native paywall does not visibly use the localized price and quota");
  forbidMatch(failures, paywall, /referencePaywall|Coach/, "Paywall contains baked artwork or Coach claims");
  requireMatch(failures, coach, /Preview — not included in Formie Pro yet/, "Coach preview disclosure is missing");
  forbidMatch(failures, coach, /RecordingPicker|TextInput|onPress/, "Coach preview contains simulated controls");
  requireMatch(failures, websiteVisuals, /Coach Preview/, "Reusable website visuals do not identify Coach as a preview");
  forbidMatch(failures, websiteVisuals, /Ask Formie Coach|Coach included/i, "Reusable website visuals imply that Coach is functional or included");
  if (store.apple.release.automaticRelease !== false) failures.push("App Store release is not manual");
  if (store.apple.advisory.ageRatingOverride !== "SEVENTEEN_PLUS" || store.apple.advisory.ageRatingOverrideV2 !== "EIGHTEEN_PLUS") failures.push("App Store age overrides are not 17+/18+");
  if (store.apple.info["en-US"].privacyChoicesUrl !== "https://useformie.com/privacy-choices") failures.push("Privacy Choices URL is missing");
  if (privacyLabels.tracking !== false) failures.push("Privacy label tracking must be No");
  if (!privacyLabels.notCollected?.includes("Cross-company Tracking")) failures.push("Privacy manifest does not explicitly record no cross-company tracking");
  requireMatch(failures, env, /GEMINI_PAID_SERVICE_CONFIRMED=false|GEMINI_PAID_SERVICE_CONFIRMED=/, "Paid Gemini governance marker is missing");
  requireMatch(failures, env, /GEMINI_VOLUNTARY_LOG_SHARING_DISABLED=false|GEMINI_VOLUNTARY_LOG_SHARING_DISABLED=/, "Gemini voluntary-log-sharing marker is missing");
  requireMatch(failures, geminiGovernance, /GEMINI_PAID_SERVICE_NOT_CONFIRMED/, "Gemini paid-service governance does not fail closed");
  requireMatch(failures, geminiGovernance, /GEMINI_VOLUNTARY_LOG_SHARING_NOT_DISABLED/, "Gemini voluntary-log-sharing governance does not fail closed");
  requireMatch(failures, geminiGovernance, /"gemini-3\.7-flash"[\s\S]*"gemini-3\.1-flash-lite"/, "Approved GA analysis models are missing from Gemini governance");
  forbidMatch(failures, geminiGovernance, /"[^"\n]*(?:preview|latest|experimental|exp)[^"\n]*"/, "Preview, experimental, or mutable Gemini model is production-approved");
  requireMatch(failures, geminiGenerate, /assertGenerallyAvailableGeminiModel\(model\)/, "Gemini generation does not enforce a GA model");
  requireMatch(failures, geminiFiles, /GEMINI_GOVERNANCE_REQUIRED_FOR_UPLOAD/, "Gemini uploads do not require paid-service governance");
  requireMatch(failures, env, /AI_PROCESSING_CONSENT_VERSION=\S+/, "AI consent version declaration is missing");
  requireMatch(failures, env, /AI_PROCESSING_NOTICE_SHA256=[a-f0-9]{64}/, "AI consent notice hash declaration is missing");
  requireMatch(failures, env, /YOUTUBE_DATA_API_KEY=/, "YouTube server key declaration is missing");
  forbidMatch(failures, env, /GOOGLE_SHEETS_|SUPABASE_AUTH_EXTERNAL_GOOGLE/, "Retired Google Sheets or Google login secrets remain declared");
  if (!existsSync(`${root}/docs/app-store/content-rights-youtube.md`)) failures.push("YouTube content-rights record is missing");
  if (!existsSync(`${root}/docs/app-store/1.0-compliance-package.md`)) failures.push("Compliance package is missing");

  if (process.env.FORMIE_REQUIRE_LIVE_PROVIDER_GATES === "true") {
    if (process.env.GEMINI_PAID_SERVICE_CONFIRMED !== "true") failures.push("Live paid Gemini project has not been confirmed");
    if (process.env.GEMINI_VOLUNTARY_LOG_SHARING_DISABLED !== "true") failures.push("Gemini voluntary log sharing has not been confirmed disabled");
    if (!process.env.YOUTUBE_DATA_API_KEY) failures.push("Live YouTube Data API key is missing");
  }
  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = auditAppStorePolicy();
  if (failures.length) { console.error(failures.map((failure) => `- ${failure}`).join("\n")); process.exit(1); }
  console.log("[app-store-policy] static policy audit passed");
}
