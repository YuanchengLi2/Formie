import { runV49Pipeline } from "./pipeline-runner";

it("does not call Flash-Lite or commit a result when Gemini 3.6 is unable", async () => {
  const writeCoaching = jest.fn();
  const commitResult = jest.fn();
  const failUnable = jest.fn();
  const output = await runV49Pipeline({ runId: "run-1" }, {
    findProblems: async () => ({ status: "unable", unableReason: { code: "movement_not_visible", message: "Movement is outside the frame." }, problems: [] }),
    writeCoaching,
    mapResult: jest.fn(),
    commitResult,
    failUnable,
  });
  expect(output.status).toBe("unable");
  expect(writeCoaching).not.toHaveBeenCalled();
  expect(commitResult).not.toHaveBeenCalled();
  expect(failUnable).toHaveBeenCalledWith("run-1", { code: "movement_not_visible", message: "Movement is outside the frame." });
});

it("runs exactly one problem stage and one writer stage before commit", async () => {
  const findProblems = jest.fn(async () => ({ status: "complete" as const, unableReason: null, problems: [] }));
  const writeCoaching = jest.fn(async () => ({ overallAssessment: "Good", corrections: [] }));
  const result = { status: "complete" };
  const commitResult = jest.fn();
  await runV49Pipeline({ runId: "run-1" }, { findProblems, writeCoaching, mapResult: () => result, commitResult, failUnable: jest.fn() });
  expect(findProblems).toHaveBeenCalledTimes(1);
  expect(writeCoaching).toHaveBeenCalledTimes(1);
  expect(commitResult).toHaveBeenCalledWith("run-1", result);
});
