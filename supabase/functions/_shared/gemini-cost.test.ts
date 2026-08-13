import { estimatedGemini36FlashCost, estimatedGeminiCost } from "./gemini-cost";

describe("Gemini 3.6 Flash paid-tier cost", () => {
  it("records prompt plus output and thinking token cost", () => {
    expect(estimatedGemini36FlashCost({ promptTokens: 36_965, outputTokens: 1_647, thinkingTokens: 1_450 })).toBe(0.078675);
  });

  it("returns null when provider usage is absent", () => {
    expect(estimatedGemini36FlashCost()).toBeNull();
  });
});

describe("model-aware Gemini cost", () => {
  it("uses Gemini 3.7 Flash introductory pricing for the video analyst", () => {
    expect(estimatedGeminiCost("gemini-3.7-flash", { promptTokens: 1_000_000, outputTokens: 500_000, thinkingTokens: 500_000 })).toBe(4.5);
  });

  it("uses Flash Lite pricing for the text writer", () => {
    expect(estimatedGeminiCost("gemini-3.1-flash-lite", { promptTokens: 1_000_000, outputTokens: 500_000, thinkingTokens: 500_000 })).toBe(1.75);
  });
});
