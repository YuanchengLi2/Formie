import { readFileSync } from "node:fs";
import { join } from "node:path";

const functionsRoot = join(process.cwd(), "supabase", "functions");

function source(name: string): string {
  return readFileSync(join(functionsRoot, name, "index.ts"), "utf8");
}

describe("edge request security wiring", () => {
  it.each([
    "account-dashboard",
    "analysis-status",
    "analyze-video",
    "analyze-video-v49",
    "cancel-analysis",
    "coach-chat",
    "complete-upload",
    "create-analysis",
    "delete-account",
    "delete-analysis",
    "exercise-guide",
    "exercise-tutorial",
    "reanalyze-video",
    "recording-preflight",
    "refresh-entitlement",
    "send-feedback",
    "subscription-test-controls",
    "sync-acquisition-sheet",
  ])("enforces the shared browser/native policy and dynamic response CORS for %s", (name) => {
    const contents = source(name);
    expect(contents).toContain("secureBrowserRequest(request");
    expect(contents).toContain("withCors(request,");
    expect(contents).not.toMatch(/Access-Control-Allow-Origin["']?\s*[:=]\s*["']\*/);
  });

  it.each([
    "cleanup-expired-analyses",
    "reconcile-entitlements",
    "retry-analysis",
    "revenuecat-webhook",
    "send-support",
  ])("keeps %s non-browser accessible with bounded bodies", (name) => {
    const contents = source(name);
    expect(contents).toContain("validateRequestSecurity(request");
    expect(contents).toContain("allowBrowserOrigin: false");
    expect(contents).toMatch(/maxBodyBytes:\s*[\d_]+/);
  });
});
