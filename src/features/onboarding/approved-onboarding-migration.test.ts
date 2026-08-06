import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("approved onboarding profile defaults", () => {
  it("removes the legacy auto-complete defaults that can skip onboarding", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/202608050001_require_approved_onboarding.sql"),
      "utf8",
    );

    expect(sql).toContain("alter column onboarding_step set default 'welcome'");
    expect(sql).toContain("alter column onboarding_completed set default false");
    expect(sql).toContain("alter column onboarding_completed_at drop default");
  });

  it("does not ship the abandoned username-column migration", () => {
    expect(existsSync(resolve(process.cwd(), "supabase/migrations/202608060002_unique_profile_usernames.sql"))).toBe(false);
  });
});
