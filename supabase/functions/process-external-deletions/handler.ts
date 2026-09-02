import type { ExternalDeletionOperation, ExternalDeletionProvider } from "../_shared/external-deletion.ts";

export type ExternalDeletionQueueJob = { id: string; provider: ExternalDeletionProvider; operation: ExternalDeletionOperation; encryptedPayload: string; attempts: number; expiresAt: string };
export type ProcessExternalDeletionDependencies = {
  authenticate: (request: Request) => Promise<void>;
  claimDue: (limit: number) => Promise<ExternalDeletionQueueJob[]>;
  execute: (job: ExternalDeletionQueueJob) => Promise<void>;
  complete: (jobId: string) => Promise<void>;
  retry: (jobId: string, input: { attempts: number; nextRetryAt: string; errorCode: string }) => Promise<void>;
  terminal: (job: ExternalDeletionQueueJob, input: { attempts: number; errorCode: string }) => Promise<void>;
  now?: () => Date;
};

function json(payload: unknown, status: number): Response { return Response.json(payload, { status }); }

export async function processExternalDeletionsHandler(request: Request, dependencies: ProcessExternalDeletionDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  try { await dependencies.authenticate(request); } catch { return json({ code: "UNAUTHORIZED" }, 401); }
  try {
    const now = dependencies.now?.() ?? new Date();
    const jobs = await dependencies.claimDue(25);
    let completed = 0; let retried = 0; let terminal = 0;
    for (const job of jobs) {
      try {
        await dependencies.execute(job);
        await dependencies.complete(job.id);
        completed += 1;
      } catch (error) {
        const attempts = job.attempts + 1;
        const errorCode = error && typeof error === "object" && "code" in error ? String(error.code).slice(0, 80) : "PROVIDER_DELETE_FAILED";
        if (attempts >= 12 || Date.parse(job.expiresAt) <= now.getTime()) {
          await dependencies.terminal(job, { attempts, errorCode });
          terminal += 1;
        } else {
          const delayMs = Math.min(24 * 60 * 60 * 1_000, 60_000 * 2 ** Math.min(attempts - 1, 10));
          await dependencies.retry(job.id, { attempts, errorCode, nextRetryAt: new Date(now.getTime() + delayMs).toISOString() });
          retried += 1;
        }
      }
    }
    return json({ processed: jobs.length, completed, retried, terminal }, 200);
  } catch { return json({ code: "EXTERNAL_DELETION_WORKER_FAILED" }, 500); }
}
