export const dashboardWindows = ["24h", "7d", "30d", "90d", "all"] as const;
export type DashboardWindow = typeof dashboardWindows[number];
export type DashboardFilters = { window: DashboardWindow; exerciseId: number | null };
export function parseDashboardFilters(input: URLSearchParams | Record<string, string | string[] | undefined>): DashboardFilters {
  const value = (key: string) => input instanceof URLSearchParams ? input.get(key) : Array.isArray(input[key]) ? input[key]?.[0] ?? null : input[key] ?? null;
  const window = value("window") ?? "30d"; if (!dashboardWindows.includes(window as DashboardWindow)) throw new Error("Invalid dashboard window");
  const rawExercise = value("exerciseId"); let exerciseId: number | null = null;
  if (rawExercise !== null && rawExercise !== "") { exerciseId = Number(rawExercise); if (!Number.isInteger(exerciseId) || exerciseId <= 0) throw new Error("Invalid exercise id"); }
  return { window: window as DashboardWindow, exerciseId };
}
