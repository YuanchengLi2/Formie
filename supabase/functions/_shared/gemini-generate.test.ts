import { buildImageGenerateContentRequest, buildTextGenerateContentRequest, buildVideoGenerateContentRequest, createGenerateContentClient, parseGenerateContentResponse } from "./gemini-generate";
import { geminiGovernanceFromValues } from "./gemini-governance";

const governance = geminiGovernanceFromValues({
  paidServiceConfirmed: "true",
  voluntaryLogSharingDisabled: "true",
});

const file = { uri: "gemini://video", mimeType: "video/mp4" };
const schema = { type: "object", required: ["status"], properties: { status: { type: "string" } } };

describe("whole-video Gemini request construction", () => {
  it("builds a fixed 12 FPS high-thinking inline whole-video request", () => {
    const request = buildVideoGenerateContentRequest({
      video: { kind: "inline", data: "encoded-video", mimeType: "video/mp4" },
      prompt: "Watch the complete exercise before coaching.",
      schema,
      fps: 12,
      thinkingLevel: "high",
      mediaResolution: "MEDIA_RESOLUTION_HIGH",
      temperature: 0,
    });

    expect(request.contents[0].parts[0]).toEqual({
      inlineData: { mimeType: "video/mp4", data: "encoded-video" },
      videoMetadata: { fps: 12 },
    });
    expect(request.generationConfig).toMatchObject({
      thinkingConfig: { thinkingLevel: "high" },
      mediaResolution: "MEDIA_RESOLUTION_HIGH",
      temperature: 0,
    });
  });

  it("builds one fixed 12 FPS high-thinking inline replay window", () => {
    const request = buildVideoGenerateContentRequest({
      video: { kind: "inline", data: "encoded-video", mimeType: "video/mp4" },
      prompt: "Review only this uncertain moment.",
      schema,
      fps: 12,
      thinkingLevel: "high",
      mediaResolution: "MEDIA_RESOLUTION_HIGH",
      window: { startMs: 2_000, endMs: 5_000 },
    });

    expect(request.contents[0].parts[0]).toEqual({
      inlineData: { mimeType: "video/mp4", data: "encoded-video" },
      videoMetadata: { fps: 12, startOffset: "2s", endOffset: "5s" },
    });
  });

  it("preserves Gemini prompt blocks as a stable provider error", () => {
    expect(() => parseGenerateContentResponse({
      promptFeedback: { blockReason: "PROHIBITED_CONTENT" },
      candidates: [],
      usageMetadata: { promptTokenCount: 61_234 },
    })).toThrow(expect.objectContaining({
      code: "GEMINI_PROHIBITED_CONTENT",
      blockReason: "PROHIBITED_CONTENT",
    }));
  });

  it("preserves billable usage when a successful provider response contains invalid JSON", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "not-json" }] } }],
      usageMetadata: { promptTokenCount: 1_200, candidatesTokenCount: 300, thoughtsTokenCount: 500 },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const client = createGenerateContentClient({ apiKey: "key", governance, fetcher });

    await expect(client.generate("gemini-3.1-flash-lite", buildTextGenerateContentRequest({ prompt: "Write", schema, thinkingLevel: "low" })))
      .rejects.toMatchObject({ usage: { promptTokens: 1_200, outputTokens: 300, thinkingTokens: 500 } });
  });

  it("lets Gemini use native temporal sampling for the complete high-resolution video", () => {
    const request = buildVideoGenerateContentRequest({ file, prompt: "Analyze everything", schema, fps: null, thinkingLevel: "high", mediaResolution: "MEDIA_RESOLUTION_HIGH" });
    expect(request.contents[0].parts[0]).toEqual({ fileData: { fileUri: file.uri, mimeType: file.mimeType } });
    expect(request.generationConfig).toEqual(expect.objectContaining({ thinkingConfig: { thinkingLevel: "high" }, mediaResolution: "MEDIA_RESOLUTION_HIGH" }));
    expect(request.generationConfig).not.toHaveProperty("temperature");
  });

  it("builds a low-thinking text-only writer request", () => {
    const request = buildTextGenerateContentRequest({
      systemInstruction: "Write specific coaching without changing evidence.",
      prompt: "Rewrite immutable facts",
      schema,
      thinkingLevel: "low",
    });
    expect(request.systemInstruction).toEqual({ parts: [{ text: "Write specific coaching without changing evidence." }] });
    expect(request.contents).toEqual([{ role: "user", parts: [{ text: "Rewrite immutable facts" }] }]);
    expect(request.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(JSON.stringify(request)).not.toContain("fileData");
  });

  it("preserves required writer collection bounds", () => {
    const request = buildTextGenerateContentRequest({
      prompt: "Rewrite every finding",
      schema: { type: "object", properties: { findings: { type: "array", minItems: 4, maxItems: 6, items: { type: "string" } } } },
      thinkingLevel: "low",
      preserveSchemaBounds: true,
    });

    expect((request.generationConfig.responseJsonSchema as any).properties.findings).toMatchObject({ minItems: 4, maxItems: 6 });
  });

  it("caps low-resolution image checks to a small output budget", () => {
    const request = buildImageGenerateContentRequest({
      images: [{ mimeType: "image/jpeg", data: "encoded" }],
      prompt: "Check recording quality",
      schema,
      thinkingLevel: "minimal",
      mediaResolution: "MEDIA_RESOLUTION_LOW",
      maxOutputTokens: 512,
    });

    expect(request.generationConfig).toEqual(expect.objectContaining({
      thinkingConfig: { thinkingLevel: "minimal" },
      mediaResolution: "MEDIA_RESOLUTION_LOW",
      maxOutputTokens: 512,
    }));
  });

  it("supports deterministic image classification for binary gates", () => {
    const request = buildImageGenerateContentRequest({
      images: [{ mimeType: "image/jpeg", data: "encoded" }],
      prompt: "Classify camera geometry",
      schema,
      thinkingLevel: "minimal",
      mediaResolution: "MEDIA_RESOLUTION_LOW",
      maxOutputTokens: 256,
      temperature: 0,
    });

    expect(request.generationConfig.temperature).toBe(0);
  });

  it("turns a provider call that exceeds its bound into a terminal timeout", async () => {
    jest.useFakeTimers();
    try {
      const fetcher = jest.fn(async (_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }));
      const client = createGenerateContentClient({ apiKey: "key", governance, fetcher });
      const pending = client.generate("gemini-3.1-flash-lite", buildTextGenerateContentRequest({ prompt: "Write", schema, thinkingLevel: "low" }), { timeoutMs: 1_000 });
      const assertion = expect(pending).rejects.toMatchObject({ code: "GEMINI_HTTP_504", status: 504 });
      await jest.advanceTimersByTimeAsync(1_000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it("sends only the disputed video windows for a contradiction review", () => {
    const request = buildVideoGenerateContentRequest({
      file,
      prompt: "Resolve these contradictions",
      schema,
      fps: 12,
      thinkingLevel: "medium",
      mediaResolution: "MEDIA_RESOLUTION_HIGH",
      windows: [
        { startMs: 4_500, endMs: 7_250 },
        { startMs: 15_000, endMs: 18_000 },
      ],
    });

    expect(request.contents[0].parts).toEqual([
      {
        fileData: { fileUri: file.uri, mimeType: file.mimeType },
        videoMetadata: { fps: 12, startOffset: "4.5s", endOffset: "7.25s" },
      },
      {
        fileData: { fileUri: file.uri, mimeType: file.mimeType },
        videoMetadata: { fps: 12, startOffset: "15s", endOffset: "18s" },
      },
      { text: "Resolve these contradictions" },
    ]);
  });

  it("removes validation-only bounds that exceed Gemini structured-output complexity", () => {
    const boundedSchema = {
      type: "object",
      required: ["score", "findings"],
      properties: {
        score: { type: "number", minimum: 0, maximum: 100 },
        findings: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: { type: "object", required: ["title"], properties: { title: { type: "string" } } },
        },
      },
    };

    const request = buildVideoGenerateContentRequest({
      file,
      prompt: "Analyze everything",
      schema: boundedSchema,
      fps: 12,
      thinkingLevel: "high",
      mediaResolution: "MEDIA_RESOLUTION_HIGH",
    });

    expect(request.generationConfig.responseJsonSchema).toEqual({
      type: "object",
      required: ["score", "findings"],
      properties: {
        score: { type: "number" },
        findings: {
          type: "array",
          items: { type: "object", required: ["title"], properties: { title: { type: "string" } } },
        },
      },
    });
  });

  it("preserves supported schema bounds when a caller requires provider enforcement", () => {
    const request = buildVideoGenerateContentRequest({
      file,
      prompt: "Return at least four findings",
      schema: { type: "object", properties: { findings: { type: "array", minItems: 4, items: { type: "string" } } } },
      fps: 4,
      thinkingLevel: "high",
      mediaResolution: "MEDIA_RESOLUTION_HIGH",
      preserveSchemaBounds: true,
    });

    expect((request.generationConfig.responseJsonSchema as any).properties.findings.minItems).toBe(4);
  });

  it("removes unsupported JSON Schema keywords before sending a bounded schema to Gemini", () => {
    const request = buildVideoGenerateContentRequest({
      file,
      prompt: "Return four findings with distinct affected repetitions",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["findings"],
        properties: {
          findings: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            uniqueItems: true,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["affectedRepNumbers"],
              properties: {
                affectedRepNumbers: {
                  type: "array",
                  minItems: 1,
                  uniqueItems: true,
                  items: { type: "integer", minimum: 1 },
                },
              },
            },
          },
        },
      },
      fps: 8,
      thinkingLevel: "high",
      mediaResolution: "MEDIA_RESOLUTION_HIGH",
      preserveSchemaBounds: true,
    });

    expect(request.generationConfig.responseJsonSchema).toEqual({
      type: "object",
      additionalProperties: false,
      required: ["findings"],
      properties: {
        findings: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["affectedRepNumbers"],
            properties: {
              affectedRepNumbers: {
                type: "array",
                minItems: 1,
                items: { type: "integer", minimum: 1 },
              },
            },
          },
        },
      },
    });
  });
});
