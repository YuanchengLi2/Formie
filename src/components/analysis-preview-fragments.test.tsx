import { fireEvent, render } from "@testing-library/react-native";

import { AnalysisTabs, LayeredAnalysisPreview } from "./analysis-preview-fragments";

describe("analysis preview fragments", () => {
  it("renders a usable tabbed preview without any model call", async () => {
    const onChange = jest.fn();
    const screen = await render(<LayeredAnalysisPreview onTabChange={onChange} />);
    expect(screen.getByTestId("layered-analysis-preview")).toBeTruthy();
    expect(screen.getByText("What happened")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("What to do next"));
    expect(onChange).toHaveBeenCalledWith("next");
  });

  it("exposes tabs with selected state", async () => {
    const screen = await render(<AnalysisTabs tab="why" />);
    expect(screen.getByLabelText("Why it matters").props.accessibilityState).toEqual({ selected: true });
  });

  it("shrinks the full preview as one bounded short composition without clipping its cue", async () => {
    const screen = await render(<LayeredAnalysisPreview density="short" />);
    expect(screen.getByTestId("preview-video-frame")).toHaveStyle({ height: 66 });
    expect(screen.getByText("NEXT-SET CUE")).toBeTruthy();
    expect(screen.getByLabelText("What happened")).toHaveStyle({ minHeight: 32 });
  });
});
