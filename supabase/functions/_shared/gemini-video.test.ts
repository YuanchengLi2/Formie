import { GEMINI_ANALYSIS_JSON_SCHEMA } from "./analysis-contract";
import { createGeminiVideoClient } from "./gemini-video";

function validCandidate() {
  const evidence = { startMs: 1_000, endMs: 1_500, repNumber: 1, phase: "concentric", visualEvidence: "The torso stays still.", visibleBodyAreas: ["torso"], confidence: 0.9 };
  return {
    status: "complete",
    recognition: { label: "Curl", variation: null, equipment: ["dumbbells"], confidence: 0.9, alternatives: [], catalogExerciseId: null, cameraView: "side" },
    videoCheck: { outcome: "usable", usableObservations: ["upper body"], limitations: [], retryReason: null, retryInstruction: null },
    overallAssessment: "The visible repetition was controlled.",
    score: null,
    scoreRationale: [],
    didWell: [{ id: "stable", title: "Stable torso", detail: "The torso stayed still.", whyItMatters: "This keeps the curl focused.", correction: null, cue: null, severity: "note", evidence: [evidence] }],
    priorityCorrections: [],
    coachingCues: [],
    viewNote: "The side view showed the torso.",
    comparison: null,
  };
}

describe("Gemini video client", () => {
  it("uses a resumable Files API upload", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "x-goog-upload-url": "https://upload.example/session" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ file: { name: "files/file-1", uri: "https://generativelanguage.googleapis.com/v1beta/files/file-1", mimeType: "video/mp4", state: "PROCESSING" } }), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    const file = await client.uploadVideo({ body: new Uint8Array([1, 2, 3]), contentLength: 3, mimeType: "video/mp4", displayName: "session-1.mp4" });

    expect(file.name).toBe("files/file-1");
    expect(fetcher.mock.calls[0][1].headers).toEqual(expect.objectContaining({ "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start" }));
    expect(fetcher.mock.calls[1][0]).toBe("https://upload.example/session");
    expect(fetcher.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "POST", body: expect.any(Uint8Array) }));
  });

  it("places the original video before one prompt and requests 24 fps", async () => {
    const response = { candidates: [{ content: { parts: [{ text: JSON.stringify(validCandidate()) }] } }] };
    const fetcher = jest.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    await client.generateAnalysis({
      file: { name: "files/file-1", uri: "https://generativelanguage.googleapis.com/v1beta/files/file-1", mimeType: "video/mp4", state: "ACTIVE" },
      prompt: "Identify the actual camera view and coach the visible set.",
      durationMs: 5_000,
    });

    const request = JSON.parse(String(fetcher.mock.calls[0][1].body));
    const parts = request.contents[0].parts;
    expect(parts[0]).toEqual({
      fileData: { mimeType: "video/mp4", fileUri: "https://generativelanguage.googleapis.com/v1beta/files/file-1" },
      videoMetadata: { fps: 24 },
    });
    expect(parts[1]).toEqual({ text: expect.stringContaining("actual camera view") });
    expect(request.generationConfig).toMatchObject({ responseMimeType: "application/json", responseJsonSchema: GEMINI_ANALYSIS_JSON_SCHEMA });
    expect(JSON.stringify(request)).not.toContain('"fps":45');
  });

  it("retries malformed structured output once", async () => {
    const valid = { candidates: [{ content: { parts: [{ text: JSON.stringify(validCandidate()) }] } }] };
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(valid), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    await expect(client.generateAnalysis({ file: { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, prompt: "coach", durationMs: 5_000 })).resolves.toMatchObject({ status: "complete" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(JSON.parse(String(fetcher.mock.calls[1][1].body)).contents[0].parts[1].text)).toContain("failed validation");
  });

  it("checks and deletes temporary Gemini files", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    await expect(client.getFile("files/file-1")).resolves.toMatchObject({ state: "ACTIVE" });
    await expect(client.deleteFile("files/file-1")).resolves.toBeUndefined();
    expect(String(fetcher.mock.calls[1][1].method)).toBe("DELETE");
  });
});
