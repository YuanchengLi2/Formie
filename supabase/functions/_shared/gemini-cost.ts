export type GeminiUsage = { promptTokens: number; outputTokens: number; thinkingTokens: number };
export type GeminiPrice = {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  version: string;
  source: "google_gemini_api_standard";
  effectiveAt: string;
};

const INTRO_END = Date.parse("2027-01-01T00:00:00.000Z");

export function resolveGeminiPrice(model: string, at = new Date()): GeminiPrice | null {
  if (["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"].includes(model)) {
    const introductory = at.getTime() < INTRO_END;
    return introductory
      ? { inputPerMillionUsd: 0.75, outputPerMillionUsd: 3.75, version: "gemini-3x-flash-intro-2026", source: "google_gemini_api_standard", effectiveAt: "2026-01-01T00:00:00.000Z" }
      : { inputPerMillionUsd: 1.5, outputPerMillionUsd: 7.5, version: "gemini-3x-flash-standard-2027", source: "google_gemini_api_standard", effectiveAt: "2027-01-01T00:00:00.000Z" };
  }
  if (model === "gemini-3.5-flash") return { inputPerMillionUsd: 1.5, outputPerMillionUsd: 9, version: "gemini-3.5-flash-standard-2026", source: "google_gemini_api_standard", effectiveAt: "2026-05-01T00:00:00.000Z" };
  if (model === "gemini-3.1-flash-lite") return { inputPerMillionUsd: 0.25, outputPerMillionUsd: 1.5, version: "gemini-3.1-flash-lite-standard-2026", source: "google_gemini_api_standard", effectiveAt: "2026-01-01T00:00:00.000Z" };
  if (model === "gemini-2.5-flash") return { inputPerMillionUsd: 0.3, outputPerMillionUsd: 2.5, version: "gemini-2.5-flash-standard", source: "google_gemini_api_standard", effectiveAt: "2025-06-01T00:00:00.000Z" };
  if (model === "gemini-2.5-flash-lite") return { inputPerMillionUsd: 0.1, outputPerMillionUsd: 0.4, version: "gemini-2.5-flash-lite-standard", source: "google_gemini_api_standard", effectiveAt: "2025-07-01T00:00:00.000Z" };
  return null;
}

export function estimateGeminiCost(model: string, usage: GeminiUsage | undefined, at = new Date()): { costUsd: number | null; price: GeminiPrice | null } {
  const price = resolveGeminiPrice(model, at);
  if (!usage || !price) return { costUsd: null, price };
  const inputCost = usage.promptTokens * price.inputPerMillionUsd / 1_000_000;
  const generatedCost = (usage.outputTokens + usage.thinkingTokens) * price.outputPerMillionUsd / 1_000_000;
  return { costUsd: Number((inputCost + generatedCost).toFixed(9)), price };
}

/** Historical helper retained for already-recorded Gemini 3.6 standard-price fixtures. */
export function estimatedGemini36FlashCost(usage?: GeminiUsage): number | null {
  if (!usage) return null;
  const inputCost = usage.promptTokens * 1.5 / 1_000_000;
  const generatedCost = (usage.outputTokens + usage.thinkingTokens) * 7.5 / 1_000_000;
  return Number((inputCost + generatedCost).toFixed(9));
}

export function estimatedGeminiCost(model: string, usage?: GeminiUsage, at = new Date()): number | null {
  return estimateGeminiCost(model, usage, at).costUsd;
}
