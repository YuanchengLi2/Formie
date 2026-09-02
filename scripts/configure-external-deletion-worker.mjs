import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";

export function externalDeletionWorkerConfiguration(environment) {
  const projectUrl = String(environment.SUPABASE_URL ?? environment.EXPO_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  const serviceRoleKey = String(environment.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const cronSecret = String(environment.EXTERNAL_DELETION_WORKER_SECRET ?? "").trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(projectUrl)) throw new Error("A valid SUPABASE_URL is required");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  if (cronSecret.length < 32) throw new Error("EXTERNAL_DELETION_WORKER_SECRET must be at least 32 characters");
  return { projectUrl, serviceRoleKey, cronSecret };
}

export async function configureExternalDeletionWorker(environment = process.env) {
  const { projectUrl, serviceRoleKey, cronSecret } = externalDeletionWorkerConfiguration(environment);
  const supabase = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.rpc("configure_external_deletion_worker", {
    p_project_url: projectUrl,
    p_cron_secret: cronSecret,
  });
  if (error) throw new Error(`External deletion worker configuration failed: ${error.code ?? "RPC_FAILED"}`);
  return { configured: true, schedule: "every minute" };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await configureExternalDeletionWorker();
  console.log(`[external-deletion-worker] configured ${result.schedule}; secret values were not printed`);
}
