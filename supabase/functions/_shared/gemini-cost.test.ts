import { estimateGeminiCost, estimatedGemini36FlashCost, estimatedGeminiCost, resolveGeminiPrice } from "./gemini-cost";

describe("Gemini 3.6 Flash paid-tier cost", () => {
  it("records prompt plus output and thinking token cost", () => {
    expect(estimatedGemini36FlashCost({ promptTokens: 36_965, outputTokens: 1_647, thinkingTokens: 1_450 })).toBe(0.078675);
  });

  it("returns null when provider usage is absent", () => {
    expect(estimatedGemini36FlashCost()).toBeNull();
  });
});

describe("model-aware Gemini cost", () => {
  it("uses Gemini 3.8 Flash introductory pricing for the video analyst", () => {
    expect(estimatedGeminiCost("gemini-3.8-flash", { promptTokens: 1_000_000, outputTokens: 500_000, thinkingTokens: 500_000 })).toBe(4.5);
  });

  it("uses Gemini 3.7 Flash introductory pricing for the video analyst", () => {
    expect(estimatedGeminiCost("gemini-3.7-flash", { promptTokens: 1_000_000, outputTokens: 500_000, thinkingTokens: 500_000 })).toBe(4.5);
  });

  it("uses Flash Lite pricing for the text writer", () => {
    expect(estimatedGeminiCost("gemini-3.1-flash-lite", { promptTokens: 1_000_000, outputTokens: 500_000, thinkingTokens: 500_000 })).toBe(1.75);
  });

  it("does not invent cost for an unknown model", () => {
    expect(estimatedGeminiCost("gemini-future-unknown", { promptTokens: 1_000, outputTokens: 500, thinkingTokens: 0 })).toBeNull();
    expect(resolveGeminiPrice("gemini-future-unknown")).toBeNull();
  });

  it("preserves the pricing version used for a call", () => {
    expect(estimateGeminiCost("gemini-3.8-flash", { promptTokens: 1_000_000, outputTokens: 0, thinkingTokens: 0 }, new Date("2026-09-04T00:00:00Z"))).toEqual({
      costUsd: 0.75,
      price: expect.objectContaining({ version: "gemini-3x-flash-intro-2026", effectiveAt: "2026-01-01T00:00:00.000Z" }),
    });
  });
});
