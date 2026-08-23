import { fireEvent, render, waitFor } from "@testing-library/react-native";

import AnalysisUploadRoute from "@/app/analysis/upload";
import { initialCaptureState, useCaptureStore } from "@/features/capture/capture-store";
import type { SetDeclaration } from "@/features/analysis/set-declaration";

const mockReplace = jest.fn();
const mockRun = jest.fn<Promise<unknown>, [unknown?, unknown?, unknown?]>(async () => undefined);
const mockSubscribe = jest.fn((_listener?: unknown) => jest.fn());
const mockCancelUpload = jest.fn(async () => undefined);

jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("@/features/capture/analysis-upload-coordinator", () => ({
  analysisUploadCoordinator: {
    run: (recordingInput: unknown, declarationInput: unknown, previousSessionId: unknown) => mockRun(recordingInput, declarationInput, previousSessionId),
    subscribe: (listener: unknown) => mockSubscribe(listener),
    cancelUpload: () => mockCancelUpload(),
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
    useCaptureStore.setState({ ...initialCaptureState, phase: "uploading", recording, declaration, uploadSubstage: "uploading_video" });
  });

  it("uses upload-specific copy and navigates only after upload finalization", async () => {
    let resolveUpload!: (value: { sessionId: string; target: { sessionId: string; analysis: { signedUrl: string; uploadToken: string; path: string } } }) => void;
    mockRun.mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
    const screen = await render(<AnalysisUploadRoute />);

    expect(screen.getByText("Uploading your recording")).toBeTruthy();
    expect(screen.queryByText("Analyzing your movement")).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();

    resolveUpload({ sessionId: "new-session", target: { sessionId: "new-session", analysis: { signedUrl: "signed", uploadToken: "token", path: "path" } } });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: "/analysis/[session-id]", params: { "session-id": "new-session" } }));
  });

  it("keeps the local recording after failure and retries with a fresh coordinator run", async () => {
    mockRun.mockRejectedValueOnce(new Error("network unavailable")).mockImplementationOnce(() => new Promise(() => undefined));
    const screen = await render(<AnalysisUploadRoute />);
    await waitFor(() => expect(screen.getByText("Upload couldn’t finish")).toBeTruthy());
    expect(screen.getByText("Retry Upload")).toBeTruthy();
    expect(useCaptureStore.getState().recording).toEqual(recording);

    await fireEvent.press(screen.getByText("Retry Upload"));
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(2));
    expect(useCaptureStore.getState().recording).toEqual(recording);
    expect(useCaptureStore.getState().phase).toBe("uploading");
  });
});
