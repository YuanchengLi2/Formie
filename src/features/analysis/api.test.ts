import { AnalysisApiError, checkRecordingPreflight, completeAnalysisUpload, createAnalysisSession, getAnalysisStatus, getExerciseGuide, getExerciseTutorial, processAnalysis, processAndLoadAnalysis, reanalyzeAnalysis, uploadAnalysisVideo } from "./api";

jest.mock("expo-file-system", () => ({
  File: class {
    readonly exists = true;
    readonly arrayBuffer = jest.fn(() => {
      throw new Error("The native upload must not materialize the file in JavaScript.");
    });
  },
}));

const declaration = {
  exercise: { source: "catalog" as const, catalogExerciseId: 2, label: "Flat Dumbbell Bench Press" },
  amount: { kind: "reps" as const, value: 8, countScope: "total" as const },
  load: { kind: "known" as const, value: 45, unit: "lb" as const, scope: "per_hand" as const },
  side: "bilateral" as const,
  styles: [],
  focusNote: null,
};

describe("analysis API", () => {
  it("checks an ordered low-cost frame sequence with recording and exercise context", async () => {
    const frames = Array.from({ length: 24 }, (_, index) => ({
      timeMs: 200 + index * 400,
      mimeType: "image/jpeg" as const,
      data: `frame-${index}`,
    }));
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      outcome: "usable",
      reason: null,
      checks: {
        activityType: "dynamic_reps",
        visibility: "limited",
        cameraQuality: "limited",
        cameraLimitations: ["perspective_distortion"],
        movementEvidence: "usable_reps",
        visibilityRequirements: {
          source: "catalog",
          exerciseName: "Goblet Squat",
          bodyRegions: ["torso and pelvis relationship", "hips and knees through the full depth and return"],
          equipment: [],
          support: [],
          movementPhases: ["start, working range, end, and return of one complete repetition"],
        },
        missingRequirements: [],
        perspectiveDistortedRequirements: [],
        activeMovementFrameIndices: [2, 3, 4, 5, 6],
        requirementEvidence: [
          { requirement: "torso and pelvis relationship", unusableFrameIndices: [6], perspectiveDistortedFrameIndices: [] },
          { requirement: "hips and knees through the full depth and return", unusableFrameIndices: [6], perspectiveDistortedFrameIndices: [] },
          { requirement: "start, working range, end, and return of one complete repetition", unusableFrameIndices: [6], perspectiveDistortedFrameIndices: [] },
        ],
      },
      guidance: null,
    }), { status: 200 }));

    await expect(checkRecordingPreflight({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      frames,
      durationMs: 10_000,
      exerciseName: "Goblet Squat",
      catalogExerciseId: 4,
    })).resolves.toEqual({
      outcome: "usable",
      reason: null,
      checks: {
        activityType: "dynamic_reps",
        visibility: "limited",
        cameraQuality: "limited",
        cameraLimitations: ["perspective_distortion"],
        movementEvidence: "usable_reps",
        visibilityRequirements: {
          source: "catalog",
          exerciseName: "Goblet Squat",
          bodyRegions: ["torso and pelvis relationship", "hips and knees through the full depth and return"],
          equipment: [],
          support: [],
          movementPhases: ["start, working range, end, and return of one complete repetition"],
        },
        missingRequirements: [],
        perspectiveDistortedRequirements: [],
        activeMovementFrameIndices: [2, 3, 4, 5, 6],
        requirementEvidence: [
          { requirement: "torso and pelvis relationship", unusableFrameIndices: [6], perspectiveDistortedFrameIndices: [] },
          { requirement: "hips and knees through the full depth and return", unusableFrameIndices: [6], perspectiveDistortedFrameIndices: [] },
          { requirement: "start, working range, end, and return of one complete repetition", unusableFrameIndices: [6], perspectiveDistortedFrameIndices: [] },
        ],
      },
      guidance: null,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/recording-preflight",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ frames, durationMs: 10_000, exerciseName: "Goblet Squat", catalogExerciseId: 4 }),
      }),
    );
  });

  it("loads a structured pre-record guide by catalog exercise ID", async () => {
    const guide = {
      exercise: { catalogExerciseId: 88, canonicalName: "One-Arm Dumbbell Row", family: "row" },
      setup: ["Brace one hand on a stable bench."],
      execution: ["Drive the working elbow toward your hip."],
      safety: ["Keep the supporting surface from sliding."],
      cameraPlacement: ["Place the phone far enough away to keep the bench and full body visible."],
      tutorial: null,
    };
    const fetcher = jest.fn(async () => new Response(JSON.stringify(guide), { status: 200 }));

    await expect(getExerciseGuide({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      catalogExerciseId: 88,
    })).resolves.toEqual(guide);

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/exercise-guide",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ catalogExerciseId: 88 }),
      }),
    );
  });

  it("requests an AI-generated guide by custom exercise name without inventing a catalog ID", async () => {
    const guide = {
      exercise: { catalogExerciseId: null, canonicalName: "Jefferson Curl", family: "hinge" },
      setup: ["Stand securely on a stable surface."],
      execution: ["Move through the exercise with a slow visible path."],
      safety: ["Use a comfortable range."],
      cameraPlacement: ["Record from the side with the full body visible."],
      tutorial: null,
    };
    const fetcher = jest.fn(async () => new Response(JSON.stringify(guide), { status: 200 }));

    await expect(getExerciseGuide({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      customExerciseName: "  Jefferson Curl  ",
    })).resolves.toEqual(guide);

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/exercise-guide",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ customExerciseName: "Jefferson Curl" }),
      }),
    );
  });

  it("creates a session with declared context and two private upload targets", async () => {
    const fetcher = jest.fn(async () =>
      new Response(
        JSON.stringify({
          sessionId: "session-123",
          upload: { signedUrl: "https://storage.example/upload", token: "upload-token", path: "user/session.mp4" },
          analysisUpload: { signedUrl: "https://storage.example/analysis", token: "analysis-token", path: "user/analysis-input.mp4" },
          privacySafeUpload: { signedUrl: "https://storage.example/privacy", token: "privacy-token", path: "user/privacy-safe-upper-body.mp4" },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await createAnalysisSession({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      declaration,
      clientRequestId: "upload-request-1",
      privacySafeFallback: true,
    });

    expect(response.sessionId).toBe("session-123");
    expect(response.upload!.path).toBe("user/session.mp4");
    expect(response.analysisUpload.path).toBe("user/analysis-input.mp4");
    expect(response.privacySafeUpload?.path).toBe("user/privacy-safe-upper-body.mp4");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/create-analysis",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer user-jwt",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ clientRequestId: "upload-request-1", declaration, privacySafeFallback: true }),
      }),
    );
  });

  it("links a repeat recording to the previous session", async () => {
    const fetcher = jest.fn(async () =>
      new Response(
        JSON.stringify({
          sessionId: "session-456",
          upload: { signedUrl: "https://storage.example/upload", token: "upload-token", path: "user/session.mp4" },
          analysisUpload: { signedUrl: "https://storage.example/analysis", token: "analysis-token", path: "user/analysis-input.mp4" },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    await createAnalysisSession({
      previousSessionId: "session-123",
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      declaration,
    });

    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ previousSessionId: "session-123", declaration }) }),
    );
  });

  it("throws a typed error for a rejected request", async () => {
    const fetcher = jest.fn(async () =>
      new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "Sign in again" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(createAnalysisSession({ accessToken: "expired", baseUrl: "https://example.supabase.co/functions/v1", fetcher, declaration })).rejects.toEqual(
      new AnalysisApiError("Sign in again", 401, "UNAUTHORIZED"),
    );
  });

  it("uploads the original bytes through the signed URL token", async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await uploadAnalysisVideo({
      localUri: "file:///recording.mp4",
      signedUrl: "https://storage.example/object/upload/sign/analysis-videos/user/session/original.mp4",
      uploadToken: "signed-upload-token",
      body: new Blob([new Uint8Array([1, 2, 3])], { type: "video/mp4" }),
      fetcher,
    });

    const [uploadUrl, uploadRequest] = fetcher.mock.calls[0];
    expect(uploadUrl).toBe("https://storage.example/object/upload/sign/analysis-videos/user/session/original.mp4?token=signed-upload-token");
    expect(uploadRequest).toEqual(expect.objectContaining({ method: "PUT", body: expect.any(Blob) }));
    expect(uploadRequest.headers).toEqual(expect.objectContaining({ "Content-Type": "video/mp4", "x-upsert": "false" }));
    expect(uploadRequest.headers.Authorization).toBeUndefined();
  });

  it("passes the native File directly as the streaming upload body", async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await uploadAnalysisVideo({
      localUri: "file:///recording.mp4",
      signedUrl: "https://storage.example/object/upload/sign/analysis-videos/user/session/analysis-input.mp4",
      uploadToken: "signed-upload-token",
      fetcher,
    });

    const body = fetcher.mock.calls[0][1].body as { arrayBuffer?: jest.Mock };
    expect(body.arrayBuffer).toBeDefined();
    expect(body.arrayBuffer).not.toHaveBeenCalled();
  });

  it("supports an idempotent user-triggered retry for the single analysis artifact", async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await uploadAnalysisVideo({
      localUri: "file:///recording.mp4",
      signedUrl: "https://storage.example/analysis-input.mp4",
      uploadToken: "signed-upload-token",
      upsert: true,
      body: new Blob([new Uint8Array([1])], { type: "video/mp4" }),
      fetcher,
    });
    expect(fetcher.mock.calls[0][1].headers["x-upsert"]).toBe("true");
  });

  it("requests the single-analysis profile and accepts only one analysis target", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      sessionId: "session-single",
      analysisUpload: { signedUrl: "https://storage.example/analysis", token: "analysis-token", path: "user/session-single/analysis-input.mp4" },
    }), { status: 201, headers: { "Content-Type": "application/json" } }));

    const response = await createAnalysisSession({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      declaration,
      uploadProfile: "single_analysis_v1",
    });

    expect(response.upload).toBeUndefined();
    expect(response.privacySafeUpload).toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      body: JSON.stringify({ declaration, uploadProfile: "single_analysis_v1" }),
    }));
  });

  it("marks the uploaded analysis artifact as upright and full length", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ processing: true }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await completeAnalysisUpload({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      sessionId: "session-123",
      durationMs: 18_500,
      analysisInput: { kind: "upright_video", durationPreserved: true },
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/complete-upload",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          sessionId: "session-123",
          durationMs: 18_500,
          analysisInput: { kind: "upright_video", durationPreserved: true },
        }),
      }),
    );
  });

  it("advances one analysis session through the Gemini endpoint", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ sessionId: "session-123", status: "processing", stage: "video_processing", failureCode: null, durationMs: 18_500, videoUrl: null, result: null, retrying: true, attempt: 1 }), { status: 202, headers: { "Content-Type": "application/json" } }));

    await expect(processAnalysis({ accessToken: "user-jwt", baseUrl: "https://example.supabase.co/functions/v1", fetcher, sessionId: "session-123" })).resolves.toMatchObject({ stage: "video_processing", failureCode: null, durationMs: 18_500, retrying: true, attempt: 1 });
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/analyze-video",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ sessionId: "session-123" }) }),
    );
  });

  it("ignores removed legacy body-analysis fields", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      sessionId: "session-123",
      status: "processing",
      stage: "video_processing",
      durationMs: 10_000,
      videoUrl: null,
      poseTracking: { model: "MoveNet.SinglePose.Thunder" },
      result: null,
    }), { status: 202, headers: { "Content-Type": "application/json" } }));

    const parsed = await processAnalysis({ accessToken: "user-jwt", baseUrl: "https://example.supabase.co/functions/v1", fetcher, sessionId: "session-123" });
    expect(parsed).not.toHaveProperty("poseTracking");
  });

  it("shows terminal results without waiting for a second evidence-video request", async () => {
    const result = {
      status: "unable",
      recognition: { label: null, variation: null, equipment: [], confidence: 0, alternatives: [], catalogExerciseId: null, exerciseFamily: "other" },
      videoCheck: { outcome: "unable", usableObservations: [], limitations: ["No person was visible"], retryReason: "No person was visible", retryInstruction: "Keep your full body in frame" },
      overallAssessment: null,
      score: null,
      scoreRationale: [],
      didWell: [],
      priorityCorrections: [],
      coachingCues: [],
      comparison: null,
    };
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessionId: "session-123", status: "unable", stage: "coaching", videoUrl: null, result }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessionId: "session-123", status: "unable", stage: "coaching", videoUrl: "https://storage.example/private-video", result }), { status: 200 }));

    const response = await processAndLoadAnalysis({ accessToken: "user-jwt", baseUrl: "https://example.supabase.co/functions/v1", fetcher, sessionId: "session-123" });

    expect(response.videoUrl).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("loads a private evidence video only when coaching detail requests it", async () => {
    const result = {
      status: "unable",
      recognition: { label: null, variation: null, equipment: [], confidence: 0, alternatives: [], catalogExerciseId: null, exerciseFamily: "other" },
      videoCheck: { outcome: "unable", usableObservations: [], limitations: ["No person was visible"], retryReason: "No person was visible", retryInstruction: "Keep your full body in frame" },
      overallAssessment: null,
      score: null,
      scoreRationale: [],
      didWell: [],
      priorityCorrections: [],
      coachingCues: [],
      comparison: null,
    };
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessionId: "session-123", status: "unable", stage: "coaching", videoUrl: null, result }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessionId: "session-123", status: "unable", stage: "coaching", videoUrl: "https://storage.example/private-video", result }), { status: 200 }));

    const response = await processAndLoadAnalysis({ accessToken: "user-jwt", baseUrl: "https://example.supabase.co/functions/v1", fetcher, sessionId: "session-123", includeVideoUrl: true });

    expect(response.videoUrl).toBe("https://storage.example/private-video");
    expect(fetcher.mock.calls[0][0]).toBe("https://example.supabase.co/functions/v1/analyze-video");
    expect(fetcher.mock.calls[1][0]).toBe("https://example.supabase.co/functions/v1/analysis-status?sessionId=session-123");
  });

  it("opens saved analysis directly without calling the analyzer again", async () => {
    const fetcher = jest.fn(async (_input: string | URL | Request) => new Response(JSON.stringify({ sessionId: "session-123", status: "complete", stage: "coaching", durationMs: 10_000, videoUrl: "https://storage.example/private-video", result: null }), { status: 200 }));
    await getAnalysisStatus({ accessToken: "user-jwt", baseUrl: "https://example.supabase.co/functions/v1", fetcher, sessionId: "session-123" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("https://example.supabase.co/functions/v1/analysis-status?sessionId=session-123");
  });

  it("loads the AI-selected exercise tutorial without exposing the Gemini key", async () => {
    const tutorial = { videoId: "abcdefghijk", url: "https://www.youtube.com/watch?v=abcdefghijk", title: "Hammer Curl Tutorial", channel: "Trusted Coach", whyChosen: "Clear technique.", thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", searchAttributionHtml: null };
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ tutorial }), { status: 200 }));
    await expect(getExerciseTutorial({ accessToken: "user-jwt", baseUrl: "https://example.supabase.co/functions/v1", fetcher, sessionId: "session-123" })).resolves.toEqual(tutorial);
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/exercise-tutorial",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ sessionId: "session-123" }) }),
    );
  });

  it("finalizes a full-duration privacy-safe fallback when it was uploaded", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ processing: true }), { status: 200 }));

    await completeAnalysisUpload({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      sessionId: "session-123",
      durationMs: 18_500,
      analysisInput: { kind: "upright_video", durationPreserved: true },
      privacySafeFallback: { kind: "upper_body", durationPreserved: true },
    });

    expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      body: JSON.stringify({
        sessionId: "session-123",
        durationMs: 18_500,
        analysisInput: { kind: "upright_video", durationPreserved: true },
        privacySafeFallback: { kind: "upper_body", durationPreserved: true },
      }),
    }));
  });

  it("exposes the terminal failure code returned by analysis status", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      sessionId: "session-123",
      status: "failed",
      stage: "analyzing",
      failureCode: "ANALYSIS_FAILED",
      failureReason: "The movement is outside the frame.",
      durationMs: 3_826,
      videoUrl: null,
      result: null,
    }), { status: 200 }));

    await expect(getAnalysisStatus({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      sessionId: "session-123",
    })).resolves.toMatchObject({ status: "failed", failureCode: "ANALYSIS_FAILED", failureReason: "The movement is outside the frame." });
  });

  it("retries a transient worker resource limit without losing the session", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "WORKER_RESOURCE_LIMIT", message: "Not enough compute" }), { status: 546 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessionId: "session-123", status: "processing", stage: "analyzing", durationMs: 18_500, videoUrl: null, result: null }), { status: 202 }));

    await expect(processAnalysis({ accessToken: "user-jwt", baseUrl: "https://example.supabase.co/functions/v1", fetcher, sessionId: "session-123", retryDelayMs: 0 })).resolves.toMatchObject({ stage: "analyzing" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("completes upload with only the original video metadata", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ processing: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await completeAnalysisUpload({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      sessionId: "session-123",
      durationMs: 18_500,
    });
    expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      body: JSON.stringify({ sessionId: "session-123", durationMs: 18_500 }),
    }));
  });

  it("loads a resumable private video URL without requesting frame uploads", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      sessionId: "session-123",
      status: "processing",
      stage: "analyzing",
      durationMs: 10_000,
      playbackWindow: { sourceStartMs: 1_200, sourceEndMs: 8_700 },
      videoUrl: "https://storage.example/signed-original.mp4",
      result: null,
    }), { status: 200 }));

    await expect(getAnalysisStatus({ accessToken: "user-jwt", baseUrl: "https://example.supabase.co/functions/v1", fetcher, sessionId: "session-123" })).resolves.toMatchObject({
      videoUrl: "https://storage.example/signed-original.mp4",
      playbackWindow: { sourceStartMs: 1_200, sourceEndMs: 8_700 },
    });
  });

  it("queues the same saved video for development reanalysis", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ sessionId: "session-123", status: "queued", stage: "input_ready" }), { status: 202 }));

    await expect(reanalyzeAnalysis({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      sessionId: "session-123",
    })).resolves.toEqual({ sessionId: "session-123", status: "queued", stage: "input_ready" });

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/reanalyze-video",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ sessionId: "session-123" }) }),
    );
  });

  it("can replace the declaration while reusing the same saved video", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ sessionId: "session-123", status: "queued", stage: "input_ready" }), { status: 202 }));

    await reanalyzeAnalysis({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      sessionId: "session-123",
      declaration,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/reanalyze-video",
      expect.objectContaining({ body: JSON.stringify({ sessionId: "session-123", declaration }) }),
    );
  });
});
