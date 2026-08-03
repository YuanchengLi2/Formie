export type ClaimedStage = {
  resultStatus: string;
  stageRunId: string;
  leaseToken: string;
  output: unknown;
};

type StageExecutionOptions<T> = {
  claim: ClaimedStage;
  work: () => Promise<T>;
  complete: (claim: ClaimedStage, output: T) => Promise<void>;
  fail: (claim: ClaimedStage, code: string) => Promise<void>;
  errorCode?: (error: unknown) => string;
};

export function stageFailurePersistenceError(result: { data?: unknown; error?: unknown }): Error | null {
  if (result.error) {
    const message = result.error && typeof result.error === "object" && "message" in result.error
      ? String((result.error as { message?: unknown }).message ?? "Analysis stage failure update failed")
      : "Analysis stage failure update failed";
    return Object.assign(new Error(message), { code: "ANALYSIS_STAGE_FAILURE_SAVE_FAILED" });
  }
  if (!result.data) {
    return Object.assign(new Error("Analysis stage failure update did not match its lease"), {
      code: "ANALYSIS_STAGE_FAILURE_NOT_PERSISTED",
    });
  }
  return null;
}

export async function runClaimedStage<T>(options: StageExecutionOptions<T>): Promise<T> {
  if (options.claim.resultStatus === "succeeded" && options.claim.output !== null && options.claim.output !== undefined) {
    return options.claim.output as T;
  }
  if (options.claim.resultStatus !== "claimed") {
    throw Object.assign(new Error(`Analysis stage is ${options.claim.resultStatus}`), { code: "ANALYSIS_STAGE_BUSY" });
  }

  let output: T;
  try {
    output = await options.work();
  } catch (error) {
    const code = options.errorCode?.(error)
      ?? (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string"
        ? String((error as { code: string }).code)
        : "ANALYSIS_STAGE_FAILED");
    await options.fail(options.claim, code);
    throw error;
  }
  await options.complete(options.claim, output);
  return output;
}
