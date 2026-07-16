import { GEMINI_ANALYSIS_JSON_SCHEMA } from "./analysis-contract";
import { createGeminiVideoClient } from "./gemini-video";

function validCandidate() {
  const evidence = { startMs: 1_000, peakMs: 1_280, endMs: 1_500, repNumber: 1, phase: "concentric", visualEvidence: "The torso stays still.", visibleBodyAreas: ["torso"], confidence: 0.9 };
  return {
    status: "complete",
    recognition: { label: "Curl", variation: null, equipment: ["dumbbells"], confidence: 0.9, alternatives: [], catalogExerciseId: null, exerciseFamily: "curl" },
    videoCheck: { outcome: "usable", usableObservations: ["upper body"], limitations: [], retryReason: null, retryInstruction: null },
    overallAssessment: "The visible repetition was controlled.",
    score: null,
    scoreRationale: [],
    didWell: [{ id: "stable", title: "Stable torso", detail: "The torso stayed still.", whyItMatters: "This keeps the curl focused.", correction: null, cue: null, severity: "note", evidence: [evidence] }],
    priorityCorrections: [],
    coachingCues: [],
    setSummary: { totalReps: 3, consistentReps: 2, verdict: "The final repetition changed." },
    repTimeline: [{ repNumber: 1, startMs: 500, peakMs: 900, endMs: 1_300, assessment: "consistent", note: "The repetition stayed controlled." }],
    nextSetPlan: [{ id: "plan-1", action: "Keep the upper arms still", rationale: "Reduce elbow drift.", relatedFindingId: "stable" }],
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
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

  it("places the original video before one prompt and uses a faster whole-set sample", async () => {
    const response = { candidates: [{ content: { parts: [{ text: JSON.stringify(validCandidate()) }] } }] };
    const fetcher = jest.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    await client.generateAnalysis({
      file: { name: "files/file-1", uri: "https://generativelanguage.googleapis.com/v1beta/files/file-1", mimeType: "video/mp4", state: "ACTIVE" },
      prompt: "Identify the exercise attempt and coach the visible set.",
      durationMs: 5_000,
    });

    const request = JSON.parse(String(fetcher.mock.calls[0][1].body));
    const parts = request.contents[0].parts;
    expect(parts[0]).toEqual({
      fileData: { mimeType: "video/mp4", fileUri: "https://generativelanguage.googleapis.com/v1beta/files/file-1" },
      videoMetadata: { fps: 12 },
    });
    expect(parts[1]).toEqual({ text: expect.stringContaining("exercise attempt") });
    expect(request.generationConfig).toMatchObject({ responseMimeType: "application/json", responseJsonSchema: GEMINI_ANALYSIS_JSON_SCHEMA });
    expect(JSON.stringify(request)).not.toContain('"fps":45');
  });

  it("runs a lenient media-only usability check before full analysis", async () => {
    const check = {
      outcome: "unable",
      usableObservations: [],
      limitations: ["No person is visible"],
      retryReason: "No person or exercise movement is visible.",
      retryInstruction: "Keep your full body in frame and record again.",
    };
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(check) }] } }] }), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    await expect(client.checkVideo({
      file: { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" },
    })).resolves.toEqual(check);

    const request = JSON.parse(String(fetcher.mock.calls[0][1].body));
    expect(request.contents[0].parts[0].videoMetadata).toEqual({ fps: 6 });
    expect(request.contents[0].parts[1].text).toContain("blatantly unusable");
    expect(request.contents[0].parts[1].text.toLowerCase()).toContain("bad form, an unusual variation, or low recognition confidence");
    expect(request.generationConfig.responseJsonSchema.properties).toHaveProperty("outcome");
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

  it("pins a usable low-confidence attempt to its nearest named alternative", async () => {
    const candidate: any = validCandidate();
    candidate.recognition = { ...candidate.recognition, label: null, confidence: 0.58, alternatives: ["Hammer Curl"] };
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(candidate) }] } }] }), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    await expect(client.generateAnalysis({ file: { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, prompt: "coach", durationMs: 5_000 })).resolves.toMatchObject({
      recognition: { label: "Hammer Curl" },
      precisionRequest: {
        requestedRuns: 1,
        targets: [{ kind: "recognition", findingId: null, startMs: null, endMs: null }],
      },
    });
  });

  it("adds a recognition premium run when the primary analysis is materially uncertain", async () => {
    const candidate: any = validCandidate();
    candidate.recognition = { ...candidate.recognition, confidence: 0.64 };
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(candidate) }] } }] }), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    const result = await client.generateAnalysis({ file: { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, prompt: "coach", durationMs: 5_000 });

    expect(result.precisionRequest).toMatchObject({
      requestedRuns: 1,
      reason: expect.stringContaining("recognition"),
      targets: [{ kind: "recognition", question: expect.stringContaining("nearest standard exercise") }],
    });
  });

  it("does not spend a recognition premium run when identity is already confident", async () => {
    const response = { candidates: [{ content: { parts: [{ text: JSON.stringify(validCandidate()) }] } }] };
    const fetcher = jest.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    const result = await client.generateAnalysis({ file: { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, prompt: "coach", durationMs: 5_000 });

    expect(result.precisionRequest).toEqual({ requestedRuns: 0, reason: null, targets: [] });
  });

  it("adds a focused premium technique run for a marginal subtle correction", async () => {
    const candidate: any = validCandidate();
    candidate.priorityCorrections = [{
      ...candidate.didWell[0],
      id: "late-elbow-drift",
      title: "Late elbow drift",
      correction: "Keep the upper arm beside the torso.",
      cue: "Only the forearm moves.",
      evidence: [{ ...candidate.didWell[0].evidence[0], startMs: 2_000, peakMs: 2_300, endMs: 2_700, repNumber: null, confidence: 0.8 }],
    }];
    candidate.nextSetPlan = [{ id: "plan-1", action: "Keep the upper arm beside the torso", rationale: "Reduce late elbow drift.", relatedFindingId: "late-elbow-drift" }];
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(candidate) }] } }] }), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    const result = await client.generateAnalysis({ file: { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, prompt: "coach", durationMs: 5_000 });

    expect(result.precisionRequest).toMatchObject({
      requestedRuns: 1,
      reason: expect.stringContaining("subtle technique"),
      targets: [{
        kind: "technique",
        findingId: "late-elbow-drift",
        startMs: 2_000,
        endMs: 2_700,
        question: expect.stringContaining("Late elbow drift"),
      }],
    });
  });

  it("does not create a top-only precision target that leaves later corrections unaudited", async () => {
    const candidate: any = validCandidate();
    candidate.priorityCorrections = [{
      ...candidate.didWell[0],
      id: "torso-swing",
      title: "Reduce torso swing",
      correction: "Keep the ribs stacked over the hips.",
      cue: "Stay tall.",
      evidence: [{
        ...candidate.didWell[0].evidence[0],
        startMs: 2_000,
        peakMs: 2_350,
        endMs: 2_700,
        repNumber: null,
        confidence: 0.94,
        focusRegion: { centerX: 0.5, centerY: 0.48, radius: 0.18, arrowFromX: 0.78, arrowFromY: 0.2, label: "torso", confidence: 0.92 },
      }],
    }];
    candidate.nextSetPlan = [{ id: "plan-1", action: "Keep the ribs stacked", rationale: "Limit torso swing.", relatedFindingId: "torso-swing" }];
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(candidate) }] } }] }), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    const result = await client.generateAnalysis({ file: { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, prompt: "coach", durationMs: 5_000 });

    expect(result.precisionRequest).toEqual({ requestedRuns: 0, reason: null, targets: [] });
  });

  it("audits every correction and evidence frame together with no four-finding cap", async () => {
    const draft: any = validCandidate();
    draft.priorityCorrections = Array.from({ length: 6 }, (_, index) => ({
      ...draft.didWell[0],
      id: `correction-${index + 1}`,
      title: `Correction ${index + 1}`,
      correction: `Make physical change ${index + 1}.`,
      cue: `Cue ${index + 1}.`,
      evidence: [{ ...draft.didWell[0].evidence[0], peakMs: 1_250 + index * 10, coachingNote: `the visible position changes; make physical change ${index + 1}.` }],
    }));
    draft.repTimeline = [{ ...draft.repTimeline[0], endMs: 2_000 }];
    draft.nextSetPlan = [{ id: "plan-1", action: "Apply the clearest correction", rationale: "Improve the set.", relatedFindingId: "correction-1" }];
    const audited = structuredClone(draft);
    audited.priorityCorrections = audited.priorityCorrections.map((finding: any, index: number) => ({
      ...finding,
      evidence: finding.evidence.map((moment: any) => ({ ...moment, peakMs: 1_300 + index * 10 })),
    }));
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(audited) }] } }],
      usageMetadata: { promptTokenCount: 2400, candidatesTokenCount: 900, thoughtsTokenCount: 300 },
    }), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    const result = await client.verifyAnalysis({ file: { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, draft, durationMs: 10_000 });

    expect(result.priorityCorrections).toHaveLength(6);
    expect(result.priorityCorrections.map((finding) => finding.evidence[0].peakMs)).toEqual([1_300, 1_310, 1_320, 1_330, 1_340, 1_350]);
    expect(result.precisionReview).toMatchObject({ runsRequested: 1, runsUsed: 1, status: "completed", passes: [{ kind: "technique", checkedFindingId: null, outcome: "revised" }] });
    const request = JSON.parse(String(fetcher.mock.calls[0][1].body));
    expect(request.contents[0].parts[0].videoMetadata).toEqual({ fps: 24 });
    expect(request.contents[0].parts[1].text).toContain("Audit every finding and every evidence moment");
    expect(request.contents[0].parts[1].text).toContain("correction-6");
    expect(request.contents[0].parts[1].text).toContain("timing and tempo");
    expect(request.generationConfig).toMatchObject({ mediaResolution: "MEDIA_RESOLUTION_HIGH", responseJsonSchema: GEMINI_ANALYSIS_JSON_SCHEMA });
  });

  it("runs the AI-requested premium reviews with the full coaching result and prior review context", async () => {
    const draft: any = validCandidate();
    draft.recognition.confidence = 0.72;
    draft.priorityCorrections = [{ ...draft.didWell[0], id: "elbow-drift", title: "Late elbow drift", evidence: [{ ...draft.didWell[0].evidence[0], startMs: 2_000, peakMs: 2_400, endMs: 2_800, confidence: 0.82 }] }];
    draft.repTimeline = [{ repNumber: 1, startMs: 500, peakMs: 2_400, endMs: 3_000, assessment: "breakdown", note: "Elbow travel increased." }];
    draft.precisionRequest = {
      requestedRuns: 2,
      reason: "Recognition and the late-set timestamp both need review.",
      targets: [
        { kind: "recognition", findingId: null, startMs: null, endMs: null, question: "Is this specifically a hammer curl?" },
        { kind: "timestamp", findingId: "elbow-drift", startMs: 2_000, endMs: 2_800, question: "Does elbow drift peak at 2.4 seconds?" },
      ],
    };
    const recognition = { ...draft.recognition, label: "Hammer Curl", variation: "Late shoulder-assisted reps", confidence: 0.88 };
    const audited = structuredClone(draft);
    audited.precisionRequest = { requestedRuns: 0, reason: null, targets: [] };
    const first = { outcome: "revised", reason: "The neutral grip identifies a hammer curl.", finding: null, recognition };
    const second = { outcome: "confirmed", reason: "The elbow path changes at the cited frame.", finding: draft.priorityCorrections[0], recognition: null };
    const fetcher = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(audited) }] } }], usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 500, thoughtsTokenCount: 150 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(first) }] } }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 100, thoughtsTokenCount: 50 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(second) }] } }], usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 180, thoughtsTokenCount: 90 } }), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    const result = await client.verifyAnalysis({ file: { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, draft, durationMs: 10_000 });

    expect(result.recognition).toMatchObject({ label: "Hammer Curl", confidence: 0.88 });
    expect(result.precisionReview).toMatchObject({ runsRequested: 3, runsUsed: 3, status: "completed", passes: [{ kind: "technique", checkedFindingId: null }, { kind: "recognition", outcome: "revised" }, { kind: "timestamp", outcome: "confirmed" }] });
    expect(fetcher).toHaveBeenCalledTimes(3);
    const firstRequest = JSON.parse(String(fetcher.mock.calls[0][1].body));
    const secondRequest = JSON.parse(String(fetcher.mock.calls[2][1].body));
    expect(firstRequest.contents[0].parts[0].videoMetadata).toMatchObject({ fps: 24 });
    expect(firstRequest.contents[0].parts[0].videoMetadata.startOffset).toBeUndefined();
    expect(secondRequest.contents[0].parts[0].videoMetadata).toMatchObject({ fps: 24, startOffset: "1s", endOffset: "3.8s" });
    expect(secondRequest.contents[0].parts[1].text).toContain("The neutral grip identifies a hammer curl");
    expect(secondRequest.contents[0].parts[1].text).toContain("entire current coaching result");
    expect(secondRequest.generationConfig.mediaResolution).toBe("MEDIA_RESOLUTION_HIGH");
  });

  it("audits a praise-only first pass and can recover a correction it initially missed", async () => {
    const draft: any = validCandidate();
    const audited = structuredClone(draft);
    audited.priorityCorrections = [{
      ...audited.didWell[0],
      id: "missed-elbow-drift",
      title: "Elbow drift",
      correction: "Keep the upper arm beside the torso.",
      cue: "Only the forearm moves.",
      evidence: [{ ...audited.didWell[0].evidence[0], coachingNote: "the elbow moves forward; keep the upper arm beside the torso." }],
    }];
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(audited) }] } }] }), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });
    const result = await client.verifyAnalysis({ file: { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, draft, durationMs: 10_000 });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.priorityCorrections).toEqual([expect.objectContaining({ id: "missed-elbow-drift" })]);
    expect(result.precisionReview).toMatchObject({ runsRequested: 1, runsUsed: 1, status: "completed", passes: [{ kind: "technique", checkedFindingId: null, outcome: "revised" }] });
  });

  it("removes a rejected finding and replaces its unsupported action with verified advice", async () => {
    const draft: any = validCandidate();
    draft.recognition.confidence = 0.7;
    draft.priorityCorrections = [{ ...draft.didWell[0], id: "elbow-drift", title: "Elbow drift" }];
    draft.nextSetPlan = [{ id: "plan-1", action: "Pin the elbows", rationale: "Reduce drift", relatedFindingId: "elbow-drift" }];
    draft.precisionRequest = { requestedRuns: 1, reason: "The correction needs review.", targets: [{ kind: "technique", findingId: "elbow-drift", startMs: 1_000, endMs: 1_500, question: "Is elbow drift visible?" }] };
    const audited = structuredClone(draft);
    audited.precisionRequest = { requestedRuns: 0, reason: null, targets: [] };
    const fetcher = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(audited) }] } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ outcome: "rejected", reason: "The clip does not show the claimed drift.", finding: null, recognition: null }) }] } }] }), { status: 200 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    const result = await client.verifyAnalysis({ file: { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, draft, durationMs: 10_000 });

    expect(result.priorityCorrections).toEqual([]);
    expect(result.nextSetPlan).toEqual([{
      id: "plan-verified-pattern",
      action: "Maintain stable torso on every rep",
      rationale: "This keeps the curl focused.",
      relatedFindingId: "stable",
    }]);
    expect(result.verification).toMatchObject({ outcome: "rejected", checkedFindingId: "elbow-drift" });
  });

  it("stops premium spending after the first failed review and reports the attempted run honestly", async () => {
    const draft: any = validCandidate();
    draft.precisionRequest = {
      requestedRuns: 2,
      reason: "Two claims need review.",
      targets: [
        { kind: "recognition", findingId: null, startMs: null, endMs: null, question: "Confirm the exercise." },
        { kind: "technique", findingId: "stable", startMs: 500, endMs: 1_500, question: "Confirm the torso path." },
      ],
    };
    const fetcher = jest.fn(async () => new Response("unavailable", { status: 503 }));
    const client = createGeminiVideoClient({ apiKey: "secret", model: "gemini-3.5-flash", fetcher });

    const result = await client.verifyAnalysis({ file: { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" }, draft, durationMs: 10_000 });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.precisionReview).toMatchObject({ runsRequested: 1, runsUsed: 1, status: "failed", summary: "Evidence review stopped after the first failed request." });
    expect(result.precisionReview?.passes).toEqual([expect.objectContaining({ passNumber: 1, outcome: "failed" })]);
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
