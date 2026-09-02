import assert from "node:assert/strict";
import test from "node:test";

import { externalDeletionWorkerConfiguration } from "./configure-external-deletion-worker.mjs";

test("accepts one shared worker secret without exposing it in the result shape", () => {
  const configuration = externalDeletionWorkerConfiguration({
    SUPABASE_URL: "https://project-ref.supabase.co/",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
    EXTERNAL_DELETION_WORKER_SECRET: "a".repeat(32),
  });
  assert.equal(configuration.projectUrl, "https://project-ref.supabase.co");
  assert.equal(configuration.cronSecret.length, 32);
});

test("rejects an absent or weak worker secret before calling Supabase", () => {
  assert.throws(() => externalDeletionWorkerConfiguration({
    SUPABASE_URL: "https://project-ref.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
    EXTERNAL_DELETION_WORKER_SECRET: "short",
  }), /at least 32/);
});
