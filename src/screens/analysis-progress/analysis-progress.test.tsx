import { act, fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnalysisProgressScreen } from ".";

describe("AnalysisProgressScreen", () => {
  it("shows native persisted stages and never a fake percentage", async () => {
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <AnalysisProgressScreen stage="video_processing" failureMessage={null} />
      </SafeAreaProvider>,
    );
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.getByTestId("analysis-progress-native-motion", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("analysis-generated-motion", { includeHiddenElements: true }).props.accessibilityLabel).toBe("Curl analysis frame 1 of 3");
    expect(screen.queryByTestId("analysis-scan-line", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("analysis-motion-mapping", { includeHiddenElements: true }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText("Watching the complete exercise")).toBeTruthy();
    expect(screen.getByLabelText("Watching the complete exercise").props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText("Keep Formie open and stay on this page until your coaching is ready.")).toBeTruthy();
    expect(screen.queryByLabelText("Formie logo")).toBeNull();
    expect(screen.queryByText(/Your recording is ready/i)).toBeNull();
    expect(screen.getByTestId("analysis-progress-motion-surface")).toHaveStyle({ minHeight: 330 });
    expect(screen.getByTestId("analysis-frame-surface", { includeHiddenElements: true })).toHaveStyle({ height: 310 });
    expect(screen.queryByLabelText("FORM analysis progress animation")).toBeNull();
    expect(screen.queryByLabelText("Analysis figure")).toBeNull();
    expect(screen.queryByText("This usually takes a moment")).toBeNull();
  });

  it("keeps cycling the supplied frames without bordered animation containers", async () => {
    jest.useFakeTimers();
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <AnalysisProgressScreen stage="analyzing" failureMessage={null} />
      </SafeAreaProvider>,
    );
    await act(async () => undefined);
    expect(screen.getByTestId("analysis-generated-motion", { includeHiddenElements: true }).props.accessibilityLabel).toBe("Curl analysis frame 1 of 3");
    await act(async () => {
      jest.advanceTimersByTime(620);
    });
    expect(screen.getByTestId("analysis-generated-motion", { includeHiddenElements: true }).props.accessibilityLabel).toBe("Curl analysis frame 2 of 3");
    await act(async () => {
      jest.advanceTimersByTime(620);
    });
    expect(screen.getByTestId("analysis-generated-motion", { includeHiddenElements: true }).props.accessibilityLabel).toBe("Curl analysis frame 3 of 3");
    await act(async () => {
      jest.advanceTimersByTime(620);
    });
    expect(screen.getByTestId("analysis-generated-motion", { includeHiddenElements: true }).props.accessibilityLabel).toBe("Curl analysis frame 2 of 3");
    expect(screen.getByTestId("analysis-progress-motion-surface")).not.toHaveStyle({ borderWidth: 1 });
    expect(screen.getByTestId("analysis-frame-surface", { includeHiddenElements: true })).not.toHaveStyle({ borderWidth: 1 });
    jest.useRealTimers();
  });

  it("explains an analysis failure without discarding the recording", async () => {
    const onRetryAnalysis = jest.fn();
    const onRecordAgain = jest.fn();
    const onGoHome = jest.fn();
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <AnalysisProgressScreen stage="video_processing" failureMessage="FORM couldn't finish this analysis. Your recording is still saved." onRetryAnalysis={onRetryAnalysis} onRecordAgain={onRecordAgain} onGoHome={onGoHome} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText("Analysis couldn’t finish")).toBeTruthy();
    expect(screen.getByText("FORM couldn't finish this analysis. Your recording is still saved.")).toBeTruthy();
    expect(screen.getByText("Your recording is still saved securely.")).toBeTruthy();
    expect(screen.getByText("This failed attempt did not use a free analysis.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Retry Analysis"));
    await fireEvent.press(screen.getByText("Record Again"));
    await fireEvent.press(screen.getByText("Back to Home"));
    expect(onRetryAnalysis).toHaveBeenCalledTimes(1);
    expect(onRecordAgain).toHaveBeenCalledTimes(1);
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  it("offers upload retry on the analysis surface", async () => {
    const onRetryUpload = jest.fn();
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <AnalysisProgressScreen stage="uploading" failureMessage="Video upload failed" onRetryUpload={onRetryUpload} />
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByText("Retry Upload"));
    expect(onRetryUpload).toHaveBeenCalledTimes(1);
  });
});
