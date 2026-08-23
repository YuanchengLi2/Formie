/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";

describe("AnalysisRuntimeSmoke", () => {
  it("mounts the analysis anatomy surface used by saved results", async () => {
    let AnalysisRuntimeSmoke: undefined | React.ComponentType;

    expect(() => {
      AnalysisRuntimeSmoke = require("./analysis-runtime-smoke").AnalysisRuntimeSmoke;
    }).not.toThrow();

    if (!AnalysisRuntimeSmoke) return;
    const screen = await render(<AnalysisRuntimeSmoke />);

    expect(screen.getByTestId("analysis-runtime-smoke")).toBeTruthy();
    expect(screen.getByTestId("muscle-focus-figure")).toBeTruthy();
    expect(screen.getByTestId("anatomy-gesture-surface")).toBeTruthy();
  });
});
