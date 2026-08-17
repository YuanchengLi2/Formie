import { createResultsExitHandler } from "./results-exit";

describe("completed analysis exit", () => {
  it("turns a swipe-back POP into one direct dismissal to Home", () => {
    const dismissToHome = jest.fn();
    const preventDefault = jest.fn();
    const handler = createResultsExitHandler(dismissToHome);

    handler({ data: { action: { type: "GO_BACK" } }, preventDefault });
    handler({ data: { action: { type: "POP_TO_TOP" } }, preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(dismissToHome).toHaveBeenCalledTimes(1);
  });

  it("allows explicit forward and replacement navigation from Results", () => {
    const dismissToHome = jest.fn();
    const preventDefault = jest.fn();
    const handler = createResultsExitHandler(dismissToHome);

    handler({ data: { action: { type: "REPLACE" } }, preventDefault });
    handler({ data: { action: { type: "PUSH" } }, preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(dismissToHome).not.toHaveBeenCalled();
  });
});
