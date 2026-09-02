import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const requiredEnvironment = {
  APP_REVIEW_FIRST_NAME: "firstName",
  APP_REVIEW_LAST_NAME: "lastName",
  APP_REVIEW_EMAIL: "email",
  APP_REVIEW_PHONE: "phone",
  APP_REVIEW_DEMO_USERNAME: "demoUsername",
  APP_REVIEW_DEMO_PASSWORD: "demoPassword",
};

const testFlightLintFallbacks = {
  APP_REVIEW_FIRST_NAME: "TestFlight",
  APP_REVIEW_LAST_NAME: "Structural Lint",
  APP_REVIEW_EMAIL: "support@useformie.com",
  APP_REVIEW_PHONE: "+1 202 555 0100",
  APP_REVIEW_DEMO_USERNAME: "appreview@useformie.com",
  APP_REVIEW_DEMO_PASSWORD: "testflight-structural-lint-only",
};

export function injectReviewMetadata(storeConfig, environment, { mode = "review" } = {}) {
  if (!["review", "testflight"].includes(mode)) throw new Error(`Unsupported metadata lint mode: ${mode}`);
  const missing = Object.keys(requiredEnvironment).filter((name) => !String(environment[name] ?? "").trim());
  if (mode === "review" && missing.length > 0) {
    throw new Error(`Missing required secure App Review inputs: ${missing.join(", ")}`);
  }
  const review = { ...(storeConfig.apple?.review ?? {}) };
  for (const [environmentName, fieldName] of Object.entries(requiredEnvironment)) {
    review[fieldName] = String(environment[environmentName] ?? "").trim() || testFlightLintFallbacks[environmentName];
  }
  review.demoRequired = true;
  return {
    ...storeConfig,
    apple: { ...storeConfig.apple, review },
  };
}

export function metadataLintErrors(jsonText) {
  const issues = JSON.parse(jsonText);
  if (!Array.isArray(issues)) throw new Error("EAS metadata lint returned an unexpected response");
  return issues.filter((issue) => Number(issue?.severity) >= 2);
}

export function runStrictMetadataLint({ environment = process.env, configPath = "store.config.json" } = {}) {
  const original = readFileSync(configPath, "utf8");
  const mode = String(environment.APP_STORE_METADATA_LINT_MODE ?? "review").trim().toLowerCase();
  const populated = injectReviewMetadata(JSON.parse(original), environment, { mode });
  const configuredExecutable = String(environment.EAS_CLI_EXECUTABLE ?? "").trim();
  const executable = configuredExecutable || (process.platform === "win32" ? "npx.cmd" : "npx");
  const argumentsForLint = configuredExecutable
    ? ["metadata:lint", "--json"]
    : ["--yes", "eas-cli", "metadata:lint", "--json"];
  try {
    writeFileSync(configPath, `${JSON.stringify(populated, null, 2)}\n`, { mode: 0o600 });
    const result = spawnSync(executable, argumentsForLint, {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const diagnostic = String(result.stderr || result.stdout || "").trim().slice(-2000);
      throw new Error(`EAS metadata lint command failed${diagnostic ? `: ${diagnostic}` : ""}`);
    }
    const errors = metadataLintErrors(result.stdout);
    if (errors.length > 0) {
      throw new Error(`EAS metadata lint found ${errors.length} blocking issue(s): ${errors.map((issue) => issue.message).join(" | ")}`);
    }
    const missingSecureInputs = Object.keys(requiredEnvironment).filter((name) => !String(environment[name] ?? "").trim());
    return { issueCount: 0, mode, missingSecureInputs };
  } finally {
    writeFileSync(configPath, original);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = runStrictMetadataLint();
  if (result.mode === "testflight" && result.missingSecureInputs.length > 0) {
    console.log(`[eas-metadata] TestFlight-only structural lint passed; final App Review still requires: ${result.missingSecureInputs.join(", ")}`);
  } else {
    console.log(`[eas-metadata] strict App Review lint passed with ${result.issueCount} blocking issues`);
  }
}
