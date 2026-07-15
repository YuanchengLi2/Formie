import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnalysisProgressScreen } from ".";

describe("AnalysisProgressScreen", () => {
  it("shows real persisted stages and never a fake percentage", async () => {
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <AnalysisProgressScreen stage="video_processing" failureMessage={null} />
      </SafeAreaProvider>,
    );

    expect(screen.getByText("Checking your recording")).toBeTruthy();
    expect(screen.getByText("Preparing the full video")).toBeTruthy();
    expect(screen.getByText("Reviewing visible technique")).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("explains an analysis failure without discarding the recording", async () => {
    const onRecordAgain = jest.fn();
    const onGoHome = jest.fn();
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <AnalysisProgressScreen
          stage="technique_review"
          failureMessage="Analysis paused. Try again shortly."
          onRecordAgain={onRecordAgain}
          onGoHome={onGoHome}
        />
      </SafeAreaProvider>,
    );
    expect(screen.getByText("Analysis paused. Try again shortly.")).toBeTruthy();
    expect(screen.getByText("Your recording is still saved securely.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Record Again"));
    await fireEvent.press(screen.getByText("Back to Home"));
    expect(onRecordAgain).toHaveBeenCalledTimes(1);
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});
