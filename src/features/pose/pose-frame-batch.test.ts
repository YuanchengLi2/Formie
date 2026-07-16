import { fulfilledFrameValues } from "./pose-frame-batch";

describe("fulfilledFrameValues", () => {
  it("keeps usable pose frames when one thumbnail extraction fails", async () => {
    const frames = await fulfilledFrameValues([
      Promise.resolve({ timeMs: 0 }),
      Promise.reject(new Error("thumbnail unavailable")),
      Promise.resolve({ timeMs: 500 }),
    ]);

    expect(frames).toEqual([{ timeMs: 0 }, { timeMs: 500 }]);
  });
});
