import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(__dirname, "../../migrations/202608040002_subscription_access_and_analysis_quota.sql"),
  "utf8",
);

describe("service-role quota reservation wiring", () => {
  it("evaluates access for the verified user id instead of service-role auth.uid", () => {
    expect(migration).toContain("create or replace function public.get_access_status_for_user(p_user_id uuid)");
    expect(migration).toContain("select * into access from public.get_access_status_for_user(uid);");
    expect(migration).toContain("select * from public.get_access_status_for_user(auth.uid())");
  });
});
