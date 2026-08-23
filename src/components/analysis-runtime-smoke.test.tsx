/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";

describe("AnalysisRuntimeSmoke", () => {
  it("transitions from loading into the complete saved-results surface without Expo GL", async () => {
    let AnalysisRuntimeSmoke: undefined | React.ComponentType;

    expect(() => {
      AnalysisRuntimeSmoke = require("./analysis-runtime-smoke").AnalysisRuntimeSmoke;
    }).not.toThrow();

    if (!AnalysisRuntimeSmoke) return;
    const screen = await render(<AnalysisRuntimeSmoke />);

    expect(screen.getByTestId("analysis-runtime-smoke")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("analysis-runtime-results")).toBeTruthy(), { timeout: 10_000 });
    expect(screen.queryByTestId("analysis-runtime-loading")).toBeNull();
    expect(screen.getByTestId("overall-analysis-score")).toBeTruthy();
    expect(screen.getByTestId("coaching-workspace")).toBeTruthy();
    expect(screen.getByTestId("muscle-focus-section")).toBeTruthy();
    expect(screen.getByTestId("muscle-focus-figure")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Target Muscles"));
    expect(screen.getByText("Biceps, Forearms")).toBeTruthy();
    expect(screen.getByTestId("anatomy-gesture-surface")).toBeTruthy();
    expect(screen.queryByTestId("anatomy-3d-canvas")).toBeNull();
  }, 15_000);
});
