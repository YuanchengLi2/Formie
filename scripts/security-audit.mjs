import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args, cwd = process.cwd()) {
  console.log(`\n[release-security] ${command} ${args.join(" ")}`);
  const isWindowsBatch = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command);
  const result = isWindowsBatch
    ? spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `${command} ${args.join(" ")}`], { cwd, stdio: "inherit", shell: false })
    : spawnSync(command, args, { cwd, stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function assertConfiguration() {
  const cors = readFileSync("supabase/functions/_shared/request-security.ts", "utf8");
  const config = readFileSync("supabase/config.toml", "utf8");
  for (const origin of ["https://useformie.com", "https://www.useformie.com", "https://dashboard.useformie.app"]) {
    if (!cors.includes(`"${origin}"`)) throw new Error(`Missing approved origin: ${origin}`);
  }
  for (const file of capture("git", ["ls-files", "supabase/functions/**/*.ts"])) {
    if (!existsSync(file)) continue;
    const source = readFileSync(file, "utf8");
    if (/Access-Control-Allow-Origin["']?\s*[:=]\s*["']\*/.test(source)) throw new Error(`Wildcard CORS is forbidden: ${file}`);
  }
  for (const endpoint of [
    "analyze-video",
    "cleanup-expired-analyses",
    "retry-analysis",
    "reconcile-entitlements",
    "revenuecat-webhook",
    "send-support",
    "apple-authorization",
    "apple-auth-events",
    "process-external-deletions",
    "exercise-guide",
    "exercise-tutorial",
  ]) {
    if (!config.includes(`[functions.${endpoint}]`)) throw new Error(`Missing explicit function security config: ${endpoint}`);
  }
}

function scanTrackedSecrets() {
  const candidates = capture("git", ["ls-files"]);
  const findings = [];
  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/]{40,}/,
    /\b(?:sk_live_|rk_live_|whsec_)[A-Za-z0-9_-]{12,}/,
    /\bservice_role\s*[:=]\s*["'][A-Za-z0-9._-]{20,}/i,
  ];
  for (const file of candidates) {
    if (/\.(?:png|jpe?g|gif|webp|glb|mp4|mov|pdf|lock)$/i.test(file)) continue;
    let source = "";
    try { source = readFileSync(file, "utf8"); } catch { continue; }
    if (secretPatterns.some((pattern) => pattern.test(source))) findings.push(file);
  }
  if (findings.length) throw new Error(`Potential tracked secrets found in: ${findings.join(", ")}`);
  console.log("[release-security] tracked-secret scan passed (values were not printed)");
}

assertConfiguration();
scanTrackedSecrets();
run(process.execPath, ["scripts/app-store-policy-audit.mjs"]);
run(process.execPath, ["--test", "scripts/app-store-policy-audit.test.js", "scripts/app-store-submission-assets-audit.test.js", "scripts/store-metadata.test.cjs", "scripts/strict-eas-metadata-lint.test.js", "scripts/configure-external-deletion-worker.test.js"]);
run(npm, ["audit", "--omit=dev", "--audit-level=high"]);
run(npm, ["audit", "--omit=dev", "--audit-level=high"], `${process.cwd()}/website`);
run(npx, ["expo-doctor"]);
const jestArgs = ["jest", "--runInBand"];
if (process.platform === "win32") jestArgs.push("--no-watchman");
jestArgs.push(
  "supabase/functions/_shared/request-security.test.ts",
  "supabase/functions/_shared/request-security-wiring.test.ts",
  "supabase/functions/revenuecat-webhook/handler.test.ts",
  "supabase/functions/_shared/entitlement-ledger.test.ts",
  "supabase/functions/_shared/secret-envelope.test.ts",
  "supabase/functions/_shared/apple-events.test.ts",
  "supabase/functions/_shared/operational-alert.test.ts",
  "supabase/functions/_shared/external-deletion.test.ts",
  "supabase/functions/apple-authorization/handler.test.ts",
  "supabase/functions/apple-auth-events/handler.test.ts",
  "supabase/functions/process-external-deletions/handler.test.ts",
  "supabase/functions/_shared/gemini-governance.test.ts",
);
run(npx, jestArgs);
