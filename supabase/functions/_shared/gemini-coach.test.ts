import { createGeminiCoachClient } from "./gemini-coach";
import { geminiGovernanceFromValues } from "./gemini-governance";

const governance = geminiGovernanceFromValues({ paidServiceConfirmed: "true", voluntaryLogSharingDisabled: "true" });

describe("Gemini video coach", () => {
  it("locates against the full video at six FPS with an exact JSON response", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ scope: "whole_set", startMs: null, endMs: null, rationale: "Compare every repetition.", clarification: null }) }] } }], usageMetadata: {} }), { status: 200 }));
    const client = createGeminiCoachClient({ apiKey: "key", model: "gemini-3.1-flash-lite", governance, fetcher });
    await expect(client.locateQuestion({ videoFile: { name: "files/1", uri: "gemini://video", mimeType: "video/mp4", state: "ACTIVE" }, prompt: "Which rep broke down?" })).resolves.toMatchObject({ value: { scope: "whole_set" } });
    const body = JSON.parse(fetcher.mock.calls[0][1]?.body as string);
    expect(body.contents[0].parts[0]).toEqual({ fileData: { fileUri: "gemini://video", mimeType: "video/mp4" }, videoMetadata: { fps: 6 } });
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "high" } });
  });

  it("analyzes a focused clip at twelve FPS with offsets and high thinking", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ directAnswer: "The elbow flares.", observations: [{ offsetMs: 900, label: "Elbow moves outward." }], visibilityLimitations: [], nextSetAction: "Keep it close." }) }] } }], usageMetadata: {} }), { status: 200 }));
    const client = createGeminiCoachClient({ apiKey: "key", model: "gemini-3.1-flash-lite", governance, fetcher });
    await client.answerQuestion({ videoFile: { name: "files/1", uri: "gemini://video", mimeType: "video/mp4", state: "ACTIVE" }, prompt: "Analyze rep four", window: { startMs: 3_500, endMs: 9_500 } });
    const body = JSON.parse(fetcher.mock.calls[0][1]?.body as string);
    expect(body.contents[0].parts[0]).toEqual({ fileData: { fileUri: "gemini://video", mimeType: "video/mp4" }, videoMetadata: { fps: 12, startOffset: "3.5s", endOffset: "9.5s" } });
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "high" });
  });

  it("rejects a non-active file and empty structured model output", async () => {
    const client = createGeminiCoachClient({ apiKey: "key", model: "gemini-3.1-flash-lite", governance, fetcher: jest.fn(async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 })) });
    await expect(client.locateQuestion({ videoFile: { name: "files/1", uri: "uri", mimeType: "video/mp4", state: "PROCESSING" }, prompt: "prompt" })).rejects.toThrow("not ready");
    await expect(client.locateQuestion({ videoFile: { name: "files/1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, prompt: "prompt" })).rejects.toThrow("no structured text");
  });
});
