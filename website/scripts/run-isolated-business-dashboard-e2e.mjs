import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
if (process.env.FORMIE_E2E_ALLOW_MUTATIONS !== "true") throw new Error("Set FORMIE_E2E_ALLOW_MUTATIONS=true only for an isolated Supabase test project");
if (required.some((name) => !String(process.env[name] ?? "").trim())) throw new Error("Isolated dashboard E2E Supabase configuration is incomplete");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const adminEmail = `founder-dashboard-e2e-${suffix}@example.com`;
const creatorEmail = `creator-dashboard-e2e-${suffix}@example.com`;
const adminPassword = `A!${crypto.randomBytes(24).toString("base64url")}`;
const creatorPassword = `C!${crypto.randomBytes(24).toString("base64url")}`;
let adminId;
let creatorUserId;
let creatorId;

async function removeStaleFixtures() {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const creators = await service.from("creators").select("id").like("display_name", "Dashboard E2E %").lt("created_at", cutoff);
  if (creators.error) throw creators.error;
  for (const creator of creators.data ?? []) await service.from("creators").delete().eq("id", creator.id);
  for (let page = 1; ; page += 1) {
    const users = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (users.error) throw users.error;
    const stale = users.data.users.filter((user) => user.app_metadata?.formie_dashboard_e2e === true && new Date(user.created_at).getTime() < Date.parse(cutoff));
    for (const user of stale) await service.auth.admin.deleteUser(user.id);
    if (users.data.users.length < 1000) break;
  }
}

try {
  await removeStaleFixtures();
  let created = await service.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true, app_metadata: { formie_dashboard_e2e: true } });
  if (created.error || !created.data.user) throw created.error || new Error("Founder E2E identity was not created");
  adminId = created.data.user.id;
  created = await service.auth.admin.createUser({ email: creatorEmail, password: creatorPassword, email_confirm: true, app_metadata: { formie_dashboard_e2e: true } });
  if (created.error || !created.data.user) throw created.error || new Error("Creator E2E identity was not created");
  creatorUserId = created.data.user.id;

  const creator = await service.from("creators").insert({ display_name: `Dashboard E2E ${suffix}` }).select("id").single();
  if (creator.error || !creator.data) throw creator.error || new Error("Creator E2E row was not created");
  creatorId = creator.data.id;
  for (const [table, row] of [
    ["creator_memberships", { user_id: creatorUserId, creator_id: creatorId }],
    ["creator_rate_versions", { creator_id: creatorId, commission_basis_points: 1500 }],
    ["creator_links", { creator_id: creatorId, public_slug: `dashboard-e2e-${suffix}`.toLowerCase() }],
    ["business_test_accounts", { user_id: adminId, reason: "Authenticated founder dashboard E2E" }],
  ]) {
    const inserted = await service.from(table).insert(row);
    if (inserted.error) throw inserted.error;
  }

  const probe = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const credentials of [{ email: adminEmail, password: adminPassword }, { email: creatorEmail, password: creatorPassword }]) {
    const signedIn = await probe.auth.signInWithPassword(credentials);
    if (signedIn.error || !signedIn.data.user) throw signedIn.error || new Error("Generated E2E identity could not sign in");
    await probe.auth.signOut();
  }

  const cli = new URL("../node_modules/@playwright/test/cli.js", import.meta.url).pathname.replace(/^\/(.:\/)/, "$1");
  const result = spawnSync(process.execPath, [cli, "test", "tests/business-dashboards.spec.ts", ...process.argv.slice(2)], {
    cwd: new URL("..", import.meta.url).pathname.replace(/^\/(.:\/)/, "$1").replace(/\/$/, ""),
    env: { ...process.env, FORMIE_ADMIN_EMAIL: adminEmail, FORMIE_E2E_ADMIN_EMAIL: adminEmail, FORMIE_E2E_ADMIN_PASSWORD: adminPassword, FORMIE_E2E_CREATOR_EMAIL: creatorEmail, FORMIE_E2E_CREATOR_PASSWORD: creatorPassword },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  if (creatorId) await service.from("creators").delete().eq("id", creatorId);
  if (creatorUserId) await service.auth.admin.deleteUser(creatorUserId);
  if (adminId) await service.auth.admin.deleteUser(adminId);
  const checks = await Promise.all([
    creatorId ? service.from("creators").select("id", { count: "exact", head: true }).eq("id", creatorId) : Promise.resolve({ count: 0 }),
    creatorUserId ? service.auth.admin.getUserById(creatorUserId) : Promise.resolve({ data: { user: null } }),
    adminId ? service.auth.admin.getUserById(adminId) : Promise.resolve({ data: { user: null } }),
  ]);
  const clean = checks[0].count === 0 && !checks[1].data?.user && !checks[2].data?.user;
  console.log(clean ? "DASHBOARD_E2E_FIXTURES_REMOVED" : "DASHBOARD_E2E_FIXTURE_CLEANUP_INCOMPLETE");
  if (!clean) process.exitCode = 1;
}
