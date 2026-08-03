import {
  buildShortClipWindow,
  MAX_SHORT_CLIP_RECHECKS,
  runShortClipRechecks,
} from "./short-clip-recheck";

type Revision = {
  revision: number;
  recheckRequest: { centerMs: number; reason: string } | null;
};

describe("optional Gemini short-clip rechecks", () => {
  it("builds a two-second window centered on the requested moment", () => {
    expect(buildShortClipWindow(5_000, 10_000)).toEqual({ startMs: 4_000, endMs: 6_000 });
  });

  it("shifts edge windows inward and uses the whole recording when it is shorter than two seconds", () => {
    expect(buildShortClipWindow(100, 10_000)).toEqual({ startMs: 0, endMs: 2_000 });
    expect(buildShortClipWindow(9_900, 10_000)).toEqual({ startMs: 8_000, endMs: 10_000 });
    expect(buildShortClipWindow(500, 1_000)).toEqual({ startMs: 0, endMs: 1_000 });
  });

  it("lets each recheck use the latest revision and request the next uncertain moment", async () => {
    const review = jest.fn(async ({ analysis, recheckNumber }: { analysis: Revision; recheckNumber: number }) => ({
      revision: analysis.revision + 1,
      recheckRequest: recheckNumber === 1
        ? { centerMs: 7_000, reason: "Recheck the later occurrence before finalizing." }
        : null,
    }));

    const result = await runShortClipRechecks<Revision>({
      initialAnalysis: { revision: 0, recheckRequest: { centerMs: 2_000, reason: "Confirm the first uncertain moment." } },
      durationMs: 10_000,
      review,
    });

    expect(review).toHaveBeenCalledTimes(2);
    expect(review.mock.calls[0][0]).toMatchObject({
      analysis: { revision: 0 },
      request: { centerMs: 2_000 },
      window: { startMs: 1_000, endMs: 3_000 },
      recheckNumber: 1,
      remainingAfterThis: 2,
    });
    expect(review.mock.calls[1][0]).toMatchObject({
      analysis: { revision: 1 },
      request: { centerMs: 7_000 },
      window: { startMs: 6_000, endMs: 8_000 },
      recheckNumber: 2,
      remainingAfterThis: 1,
    });
    expect(result).toEqual({ analysis: { revision: 2, recheckRequest: null }, recheckCount: 2, limitReached: false });
  });

  it("does not make a recheck call when Gemini is already confident", async () => {
    const review = jest.fn();
    const initialAnalysis: Revision = { revision: 0, recheckRequest: null };

    await expect(runShortClipRechecks({ initialAnalysis, durationMs: 10_000, review })).resolves.toEqual({
      analysis: initialAnalysis,
      recheckCount: 0,
      limitReached: false,
    });
    expect(review).not.toHaveBeenCalled();
  });

  it("honors Gemini's chained requests but never performs more than three rechecks", async () => {
    const review = jest.fn(async ({ analysis }: { analysis: Revision }) => ({
      revision: analysis.revision + 1,
      recheckRequest: { centerMs: 5_000, reason: "One more genuinely uncertain view." },
    }));

    const result = await runShortClipRechecks<Revision>({
      initialAnalysis: { revision: 0, recheckRequest: { centerMs: 5_000, reason: "Uncertain." } },
      durationMs: 10_000,
      review,
    });

    expect(review).toHaveBeenCalledTimes(MAX_SHORT_CLIP_RECHECKS);
    expect(result).toMatchObject({ analysis: { revision: 3 }, recheckCount: 3, limitReached: true });
  });

  it("rejects invalid duration and request centers before calling Gemini", async () => {
    const review = jest.fn();
    await expect(runShortClipRechecks<Revision>({
      initialAnalysis: { revision: 0, recheckRequest: { centerMs: Number.NaN, reason: "Invalid." } },
      durationMs: 10_000,
      review,
    })).rejects.toThrow(/centerMs/);
    expect(() => buildShortClipWindow(500, 0)).toThrow(/durationMs/);
    expect(review).not.toHaveBeenCalled();
  });
});
