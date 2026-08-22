import { bindAnalysisResume } from "./analysis-resume";

describe("analysis app-resume lifecycle", () => {
  it("refreshes once when the app returns to active and ignores duplicate active notifications", () => {
    let listener: ((state: string) => void) | undefined;
    const remove = jest.fn();
    const onActive = jest.fn();
    const cleanup = bindAnalysisResume({
      initialState: "background",
      addListener: (next) => {
        listener = next;
        return { remove };
      },
      onActive,
    });

    listener?.("inactive");
    listener?.("active");
    listener?.("active");
    listener?.("background");
    listener?.("active");

    expect(onActive).toHaveBeenCalledTimes(2);
    cleanup();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
