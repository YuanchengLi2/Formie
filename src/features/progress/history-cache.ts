type HistoryQueryInvalidator = {
  invalidateQueries: (filters: { queryKey: string[] }) => Promise<unknown>;
};

export function invalidateAnalysisHistory(client: HistoryQueryInvalidator): Promise<unknown> {
  return client.invalidateQueries({ queryKey: ["analysis-history"] });
}
