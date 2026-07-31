type HistoryQueryInvalidator = {
  invalidateQueries: (filters: { queryKey: string[] }) => Promise<unknown>;
};

export function invalidateAnalysisHistory(client: HistoryQueryInvalidator): Promise<unknown> {
  return Promise.all([
    client.invalidateQueries({ queryKey: ["analysis-history"] }),
    client.invalidateQueries({ queryKey: ["progress-metrics"] }),
  ]);
}
