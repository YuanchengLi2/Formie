import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args, cwd = process.cwd()) {
  console.log(`\n[release-security] ${command} ${args.join(" ")}`);
  const executable = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : command;
  const executableArgs = process.platform === "win32" ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(executable, executableArgs, { cwd, stdio: "inherit", shell: false });
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
    const source = readFileSync(file, "utf8");
    if (/Access-Control-Allow-Origin["']?\s*[:=]\s*["']\*/.test(source)) throw new Error(`Wildcard CORS is forbidden: ${file}`);
  }
  for (const endpoint of ["analyze-video", "cleanup-expired-analyses", "retry-analysis", "reconcile-entitlements", "revenuecat-webhook", "send-support"]) {
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
run(npm, ["audit", "--omit=dev", "--audit-level=high"]);
run(npm, ["audit", "--omit=dev", "--audit-level=high"], `${process.cwd()}/website`);
run(npx, ["expo-doctor"]);
run(npx, ["jest", "--runInBand", "supabase/functions/_shared/request-security.test.ts", "supabase/functions/_shared/request-security-wiring.test.ts", "supabase/functions/revenuecat-webhook/handler.test.ts", "supabase/functions/_shared/entitlement-ledger.test.ts"]);
