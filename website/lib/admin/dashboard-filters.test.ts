import assert from "node:assert/strict"; import test from "node:test";
import { parseDashboardFilters } from "./dashboard-filters";
test("accepts only supported windows and positive exercise ids", () => {
  assert.deepEqual(parseDashboardFilters(new URLSearchParams()), { window: "30d", exerciseId: null });
  assert.deepEqual(parseDashboardFilters(new URLSearchParams("window=7d&exerciseId=42")), { window: "7d", exerciseId: 42 });
  assert.throws(() => parseDashboardFilters(new URLSearchParams("window=1y")), /window/i);
  assert.throws(() => parseDashboardFilters(new URLSearchParams("exerciseId=-1")), /exercise/i);
});
