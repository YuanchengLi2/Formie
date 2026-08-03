import type { UnableReason } from "./problem-finder.ts";

export type V49PipelineDependencies = {
  findProblems: () => Promise<{ status: "complete"; unableReason: null; problems: unknown[] } | { status: "unable"; unableReason: UnableReason; problems: [] }>;
  writeCoaching: (problems: unknown[]) => Promise<unknown>;
  mapResult: (problems: unknown[], writing: unknown) => unknown;
  commitResult: (runId: string, result: unknown) => Promise<void>;
  failUnable: (runId: string, reason: UnableReason) => Promise<void>;
};

export async function runV49Pipeline(input: { runId: string }, dependencies: V49PipelineDependencies): Promise<{ status: "complete"; result: unknown } | { status: "unable"; reason: UnableReason }> {
  const found = await dependencies.findProblems();
  if (found.status === "unable") {
    await dependencies.failUnable(input.runId, found.unableReason);
    return { status: "unable", reason: found.unableReason };
  }
  const writing = await dependencies.writeCoaching(found.problems);
  const result = dependencies.mapResult(found.problems, writing);
  await dependencies.commitResult(input.runId, result);
  return { status: "complete", result };
}
