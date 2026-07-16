import { invalidateAnalysisHistory } from "./history-cache";

it("refreshes home and progress after a terminal analysis is persisted", async () => {
  const invalidateQueries = jest.fn(async () => undefined);
  await invalidateAnalysisHistory({ invalidateQueries });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["analysis-history"] });
});
