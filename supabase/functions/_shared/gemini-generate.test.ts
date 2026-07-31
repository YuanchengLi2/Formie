import { buildImageGenerateContentRequest, buildTextGenerateContentRequest, buildVideoGenerateContentRequest, parseGenerateContentResponse } from "./gemini-generate";

const file = { uri: "gemini://video", mimeType: "video/mp4" };
const schema = { type: "object", required: ["status"], properties: { status: { type: "string" } } };

describe("single-pass Gemini request construction", () => {
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

  it("lets Gemini use native temporal sampling for the complete high-resolution video", () => {
    const request = buildVideoGenerateContentRequest({ file, prompt: "Analyze everything", schema, fps: null, thinkingLevel: "high", mediaResolution: "MEDIA_RESOLUTION_HIGH" });
    expect(request.contents[0].parts[0]).toEqual({ fileData: { fileUri: file.uri, mimeType: file.mimeType } });
    expect(request.generationConfig).toEqual(expect.objectContaining({ thinkingConfig: { thinkingLevel: "high" }, mediaResolution: "MEDIA_RESOLUTION_HIGH" }));
    expect(request.generationConfig).not.toHaveProperty("temperature");
  });

  it("builds a low-thinking text-only writer request", () => {
    const request = buildTextGenerateContentRequest({ prompt: "Rewrite immutable facts", schema, thinkingLevel: "low" });
    expect(request.contents).toEqual([{ role: "user", parts: [{ text: "Rewrite immutable facts" }] }]);
    expect(request.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(JSON.stringify(request)).not.toContain("fileData");
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
});
