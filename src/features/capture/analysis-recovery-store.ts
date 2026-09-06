import { Directory, File, Paths } from "expo-file-system";

import { setDeclarationSchema, type SetDeclaration } from "@/features/analysis/set-declaration";
import type { CaptureEvent, RecordedSet } from "./types";

export type UploadRecoveryJob = {
  version: 1;
  phase: "uploading" | "failed";
  userId: string;
  recording: RecordedSet;
  declaration: SetDeclaration;
  previousSessionId: string | null;
  clientRequestId: string;
  sessionId: string | null;
  error?: string;
};

export type ProcessingRecoveryJob = {
  version: 1;
  phase: "processing";
  userId: string;
  sessionId: string;
};

export type AnalysisRecoveryJob = UploadRecoveryJob | ProcessingRecoveryJob;

export type AnalysisRecoveryAdapter = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  remove: () => Promise<void>;
};

function recordedSet(value: unknown): RecordedSet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.localUri !== "string" || !item.localUri.startsWith("file:")) return null;
  if (!Number.isInteger(item.durationMs) || Number(item.durationMs) <= 0) return null;
  if (typeof item.mimeType !== "string") return null;
  if (item.byteLength !== undefined && (!Number.isInteger(item.byteLength) || Number(item.byteLength) <= 0)) return null;
  return item as RecordedSet;
}

function parseRecovery(value: string | null): AnalysisRecoveryJob | null {
  if (!value) return null;
  try {
    const item = JSON.parse(value) as Record<string, unknown>;
    if (item.version !== 1 || typeof item.userId !== "string" || item.userId.length < 1 || (typeof item.sessionId !== "string" && item.sessionId !== null)) return null;
    if (item.phase === "processing") {
      return item.sessionId ? { version: 1, phase: "processing", userId: item.userId, sessionId: item.sessionId } : null;
    }
    if (item.phase !== "uploading" && item.phase !== "failed") return null;
    const recording = recordedSet(item.recording);
    const declaration = setDeclarationSchema.safeParse(item.declaration);
    if (!recording || !declaration.success || typeof item.clientRequestId !== "string" || item.clientRequestId.length < 8) return null;
    return {
      version: 1,
      phase: item.phase,
      userId: item.userId,
      recording,
      declaration: declaration.data,
      previousSessionId: typeof item.previousSessionId === "string" ? item.previousSessionId : null,
      clientRequestId: item.clientRequestId,
      sessionId: typeof item.sessionId === "string" ? item.sessionId : null,
      ...(item.phase === "failed" && typeof item.error === "string" ? { error: item.error } : {}),
    };
  } catch {
    return null;
  }
}

export function recoveryDestination(job: AnalysisRecoveryJob | null, currentUserId: string): string | null {
  if (!job || job.userId !== currentUserId) return null;
  return job.phase === "processing" ? `/analysis/${job.sessionId}` : "/analysis/upload";
}

export function recoveryCaptureEvent(job: AnalysisRecoveryJob | null, currentUserId: string): CaptureEvent | null {
  if (!job || job.userId !== currentUserId) return null;
  if (job.phase === "processing") return { type: "processing_recovered", sessionId: job.sessionId };
  return {
    type: "upload_recovered",
    recording: job.recording,
    declaration: job.declaration,
    previousSessionId: job.previousSessionId,
    clientRequestId: job.clientRequestId,
    sessionId: job.sessionId,
    ...(job.phase === "failed" ? { error: job.error ?? "The upload was interrupted. Retry to continue." } : {}),
  };
}

export function createAnalysisClientRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `analysis-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createAnalysisRecoveryStore(adapter: AnalysisRecoveryAdapter) {
  let pending: Promise<unknown> = Promise.resolve();
  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = pending.then(operation, operation);
    pending = next.then(() => undefined, () => undefined);
    return next;
  };
  const readValid = async () => {
    const raw = await adapter.read();
    const parsed = parseRecovery(raw);
    if (raw && !parsed) await adapter.remove();
    return parsed;
  };

  return {
    load: () => serialize(readValid),
    saveUpload: (input: Omit<UploadRecoveryJob, "version" | "phase">) => serialize(async () => {
      await adapter.write(JSON.stringify({ version: 1, phase: "uploading", ...input } satisfies UploadRecoveryJob));
    }),
    markUploadFailed: (error: string) => serialize(async () => {
      const current = await readValid();
      if (!current || current.phase === "processing") return;
      await adapter.write(JSON.stringify({ ...current, phase: "failed", error } satisfies UploadRecoveryJob));
    }),
    markProcessing: (userId: string, sessionId: string) => serialize(async () => {
      await adapter.write(JSON.stringify({ version: 1, phase: "processing", userId, sessionId } satisfies ProcessingRecoveryJob));
    }),
    clear: () => serialize(() => adapter.remove()),
  };
}

function nativeAdapter(): AnalysisRecoveryAdapter {
  const directory = new Directory(Paths.document, "formie-recovery");
  const file = new File(directory, "analysis-operation.json");
  const ensureDirectory = () => directory.create({ idempotent: true, intermediates: true });
  return {
    read: async () => {
      ensureDirectory();
      return file.exists ? file.text() : null;
    },
    write: async (value) => {
      ensureDirectory();
      if (!file.exists) file.create({ intermediates: true });
      file.write(value);
    },
    remove: async () => {
      if (file.exists) file.delete();
    },
  };
}

let nativeStore: ReturnType<typeof createAnalysisRecoveryStore> | null = null;
export function getAnalysisRecoveryStore() {
  nativeStore ??= createAnalysisRecoveryStore(nativeAdapter());
  return nativeStore;
}
