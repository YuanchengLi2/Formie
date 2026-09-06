import { recordModelCallTelemetry } from "./model-telemetry";

describe("recordModelCallTelemetry", () => {
  it("persists attempt ownership and pricing provenance", async () => {
    let row: Record<string, unknown> | null = null;
    const client = {
      from: () => ({ insert: async (value: Record<string, unknown>) => { row = value; return { error: null }; } }),
    };
    await expect(recordModelCallTelemetry(client, {
      sessionId: "session",
      analysisAttemptId: "attempt",
      stage: "analyzing",
      model: "gemini-3.6-flash",
      startedAtMs: Date.now(),
      usage: { promptTokens: 1_000_000, outputTokens: 1_000_000, thinkingTokens: 0 },
      status: "succeeded",
      pricedAt: new Date("2026-09-04T00:00:00.000Z"),
    })).resolves.toBe(true);
    expect(row).toMatchObject({
      analysis_attempt_id: "attempt",
      estimated_cost_usd: 4.5,
      pricing_version: "gemini-3x-flash-intro-2026",
      pricing_coverage: "complete",
    });
  });

  it("keeps unknown models unavailable instead of inventing a fallback price", async () => {
    let row: Record<string, unknown> | null = null;
    const client = {
      from: () => ({ insert: async (value: Record<string, unknown>) => { row = value; return { error: null }; } }),
    };
    await recordModelCallTelemetry(client, {
      sessionId: "session",
      stage: "finalizing",
      model: "future-model",
      startedAtMs: Date.now(),
      usage: { promptTokens: 10, outputTokens: 10, thinkingTokens: 0 },
      status: "succeeded",
    });
    expect(row).toMatchObject({ estimated_cost_usd: null, pricing_version: null, pricing_coverage: "unpriced_model" });
  });

  it("marks missing provider usage as incomplete", async () => {
    let row: Record<string, unknown> | null = null;
    const client = {
      from: () => ({ insert: async (value: Record<string, unknown>) => { row = value; return { error: null }; } }),
    };
    await recordModelCallTelemetry(client, {
      sessionId: "session",
      stage: "analyzing",
      model: "gemini-3.6-flash",
      startedAtMs: Date.now(),
      status: "failed",
      errorCode: "TIMEOUT",
    });
    expect(row).toMatchObject({ prompt_tokens: null, estimated_cost_usd: null, pricing_coverage: "missing_usage" });
  });
});
