import { useQuery } from "@tanstack/react-query";

import { fetchAnalysisHistory } from "./api";

export function useAnalysisHistory() {
  return useQuery({ queryKey: ["analysis-history"], queryFn: () => fetchAnalysisHistory(), staleTime: 30_000 });
}
