import { createGeminiCoachClient } from "./gemini-coach";

describe("Gemini video coach", () => {
  it("sends the active video and grounded prompt in one request", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "At 00:01, level your shoulders." }] } }] }), { status: 200 }));
    const client = createGeminiCoachClient({ apiKey: "key", model: "gemini-test", fetcher });
    await expect(client.generateReply({ videoFile: { name: "files/1", uri: "gemini://video", mimeType: "video/mp4", state: "ACTIVE" }, prompt: "Selected analysis: shoulder rise" })).resolves.toContain("00:01");
    const body = JSON.parse(fetcher.mock.calls[0][1]?.body as string);
    expect(body.contents[0].parts).toEqual(expect.arrayContaining([
      { fileData: { fileUri: "gemini://video", mimeType: "video/mp4" } },
      { text: expect.stringContaining("Selected analysis") },
    ]));
  });

  it("rejects a non-active file and empty model output", async () => {
    const client = createGeminiCoachClient({ apiKey: "key", model: "model", fetcher: jest.fn(async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 })) });
    await expect(client.generateReply({ videoFile: { name: "files/1", uri: "uri", mimeType: "video/mp4", state: "PROCESSING" }, prompt: "prompt" })).rejects.toThrow("not ready");
    await expect(client.generateReply({ videoFile: { name: "files/1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, prompt: "prompt" })).rejects.toThrow("no reply");
  });
});
