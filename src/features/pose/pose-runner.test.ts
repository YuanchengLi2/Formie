import { optionalPoseResult } from "./pose-runner";

describe("optionalPoseResult", () => {
  it("returns a completed local pose summary", async () => {
    const value = { model: "MoveNet.SinglePose.Thunder" };
    await expect(optionalPoseResult(Promise.resolve(value), 100)).resolves.toBe(value);
  });

  it("does not block Gemini when local inference fails", async () => {
    await expect(optionalPoseResult(Promise.reject(new Error("webgl unavailable")), 100)).resolves.toBeNull();
  });

  it("stops waiting when local inference takes too long", async () => {
    jest.useFakeTimers();
    const result = optionalPoseResult(new Promise(() => undefined), 100);
    await jest.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBeNull();
    jest.useRealTimers();
  });
});
