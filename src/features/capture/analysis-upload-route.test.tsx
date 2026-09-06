import { fireEvent, render, waitFor } from "@testing-library/react-native";

import AnalysisUploadRoute from "@/app/analysis/upload";
import { initialCaptureState, useCaptureStore } from "@/features/capture/capture-store";
import type { SetDeclaration } from "@/features/analysis/set-declaration";

const mockReplace = jest.fn();
const mockRun = jest.fn<Promise<unknown>, [unknown?, unknown?, unknown?, unknown?]>(async () => undefined);
const mockSubscribe = jest.fn((_listener?: unknown) => jest.fn());
const mockCancelUpload = jest.fn(async () => undefined);
const mockReset = jest.fn();
const mockGetAnalysisStatus = jest.fn();
const mockSaveUpload = jest.fn(async () => undefined);
const mockMarkUploadFailed = jest.fn(async () => undefined);
const mockMarkProcessing = jest.fn(async () => undefined);
const mockClearRecovery = jest.fn(async () => undefined);

jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => ({ phase: "authenticated", user: { id: "user-1" } }) }));
jest.mock("@/features/auth/access-token", () => ({ getAccessToken: jest.fn(async () => "access-token") }));
jest.mock("@/features/analysis/api", () => ({
  getAnalysisStatus: (...args: unknown[]) => mockGetAnalysisStatus(...args),
}));
jest.mock("@/features/capture/analysis-recovery-store", () => ({
  createAnalysisClientRequestId: () => "generated-request-id",
  getAnalysisRecoveryStore: () => ({
    saveUpload: mockSaveUpload,
    markUploadFailed: mockMarkUploadFailed,
    markProcessing: mockMarkProcessing,
    clear: mockClearRecovery,
  }),
}));
jest.mock("@/features/capture/analysis-upload-coordinator", () => ({
  analysisUploadCoordinator: {
    run: (recordingInput: unknown, declarationInput: unknown, previousSessionId: unknown, recovery: unknown) => mockRun(recordingInput, declarationInput, previousSessionId, recovery),
    subscribe: (listener: unknown) => mockSubscribe(listener),
    cancelUpload: () => mockCancelUpload(),
    reset: () => mockReset(),
  },
}));

const declaration: SetDeclaration = {
  exercise: { source: "custom", catalogExerciseId: null, label: "Squat" },
  amount: { kind: "reps", value: 5, countScope: "total" },
  load: { kind: "unknown" },
  side: "bilateral",
  styles: [],
  focusNote: null,
};
const recording = { localUri: "file:///saved-set.mp4", durationMs: 18_000, mimeType: "video/mp4", byteLength: 4_500_000 };

describe("analysis upload route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribe.mockReturnValue(jest.fn());
    mockGetAnalysisStatus.mockResolvedValue({ status: "uploading", failureReason: null });
    useCaptureStore.setState({
      ...initialCaptureState,
      phase: "uploading",
      recording,
      declaration,
      uploadRequestId: "durable-request-id",
      uploadSubstage: "uploading_video",
    });
  });

  it("uses one durable request and navigates only after upload finalization is journaled", async () => {
    let resolveUpload!: (value: { sessionId: string; target: { sessionId: string; analysis: { signedUrl: string; uploadToken: string; path: string } } }) => void;
    mockRun.mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
    const screen = await render(<AnalysisUploadRoute />);

    expect(screen.getByText("Uploading your recording")).toBeTruthy();
    expect(screen.queryByText("Analyzing your movement")).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalledWith(recording, declaration, undefined, { clientRequestId: "durable-request-id" });

    resolveUpload({ sessionId: "new-session", target: { sessionId: "new-session", analysis: { signedUrl: "signed", uploadToken: "token", path: "path" } } });
    await waitFor(() => expect(mockMarkProcessing).toHaveBeenCalledWith("user-1", "new-session"));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/analysis/[session-id]", params: { "session-id": "new-session" } });
  });

  it("keeps the local recording and request identity after failure, then resumes it", async () => {
    mockRun.mockRejectedValueOnce(new Error("network unavailable")).mockImplementationOnce(() => new Promise(() => undefined));
    const screen = await render(<AnalysisUploadRoute />);
    await waitFor(() => expect(screen.getByText("Upload couldn’t finish")).toBeTruthy());
    expect(mockMarkUploadFailed).toHaveBeenCalledWith("network unavailable");
    expect(screen.getByText("Retry Upload")).toBeTruthy();
    expect(useCaptureStore.getState().recording).toEqual(recording);

    await fireEvent.press(screen.getByText("Retry Upload"));
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(2));
    expect(mockSaveUpload).toHaveBeenCalledWith(expect.objectContaining({ clientRequestId: "durable-request-id" }));
    expect(mockRun).toHaveBeenLastCalledWith(recording, declaration, undefined, { clientRequestId: "durable-request-id" });
    expect(useCaptureStore.getState().phase).toBe("uploading");
  });

  it("reconciles an accepted server session instead of uploading the video again", async () => {
    useCaptureStore.setState({ sessionId: "existing-session" });
    mockGetAnalysisStatus.mockResolvedValue({ status: "processing", failureReason: null });

    await render(<AnalysisUploadRoute />);

    await waitFor(() => expect(mockGetAnalysisStatus).toHaveBeenCalledWith({ accessToken: "access-token", sessionId: "existing-session" }));
    expect(mockRun).not.toHaveBeenCalled();
    expect(mockMarkProcessing).toHaveBeenCalledWith("user-1", "existing-session");
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/analysis/[session-id]", params: { "session-id": "existing-session" } });
  });
});
