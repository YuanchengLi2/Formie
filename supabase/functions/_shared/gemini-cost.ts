export function estimatedGemini36FlashCost(usage?: { promptTokens: number; outputTokens: number; thinkingTokens: number }): number | null {
  if (!usage) return null;
  const inputCost = usage.promptTokens * 1.5 / 1_000_000;
  const generatedCost = (usage.outputTokens + usage.thinkingTokens) * 7.5 / 1_000_000;
  return Number((inputCost + generatedCost).toFixed(9));
}

export function estimatedGeminiCost(model: string, usage?: { promptTokens: number; outputTokens: number; thinkingTokens: number }): number | null {
  if (!usage) return null;
  if (model === "gemini-3.7-flash") {
    const inputCost = usage.promptTokens * 0.75 / 1_000_000;
    const generatedCost = (usage.outputTokens + usage.thinkingTokens) * 3.75 / 1_000_000;
    return Number((inputCost + generatedCost).toFixed(9));
  }
  if (model === "gemini-3.1-flash-lite") {
    const inputCost = usage.promptTokens * 0.25 / 1_000_000;
    const generatedCost = (usage.outputTokens + usage.thinkingTokens) * 1.5 / 1_000_000;
    return Number((inputCost + generatedCost).toFixed(9));
  }
  return estimatedGemini36FlashCost(usage);
}
