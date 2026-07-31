import { useQuery } from "@tanstack/react-query";

import { deviceTimeZone, fetchProgressMetrics } from "./api";

export const progressMetricsQueryKey = ["progress-metrics", deviceTimeZone()] as const;

export function useProgressMetrics() {
  return useQuery({
    queryKey: progressMetricsQueryKey,
    queryFn: () => fetchProgressMetrics({ timeZone: progressMetricsQueryKey[1] }),
    staleTime: 30_000,
  });
}
