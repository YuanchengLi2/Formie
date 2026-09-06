import assert from "node:assert/strict";
import test from "node:test";
import { parseBusinessDashboard, parseMetric } from "./contracts";

const metric = { value: 12, unit: "money", quality: "estimated", settlement: "estimated", currency: "USD", numerator: 12, denominator: 2, observedSince: null, asOf: "2026-09-05T12:00:00Z", definition: "Fixture" };

test("reporting metrics reject non-finite numbers, invalid timestamps, and missing money currency", () => {
  assert.throws(() => parseMetric({ ...metric, value: "not-a-number" }), /value is invalid/);
  assert.throws(() => parseMetric({ ...metric, denominator: "Infinity" }), /denominator is invalid/);
  assert.throws(() => parseMetric({ ...metric, asOf: "yesterday-ish" }), /timestamp is invalid/);
  assert.throws(() => parseMetric({ ...metric, currency: null }), /currency is invalid/);
});

test("dashboard parsing rejects malformed growth arrays and alert severities", () => {
  const base = { generatedAt: "2026-09-05T12:00:00Z", rangeStart: null, rangeEnd: "2026-09-05T12:00:00Z", section: "overview", window: "30d", metrics: { revenue: metric }, trends: [], creators: [], growth: { cohorts: [] }, alerts: [] };
  assert.equal(parseBusinessDashboard(base).metrics.revenue.value, 12);
  assert.throws(() => parseBusinessDashboard({ ...base, growth: { cohorts: {} } }), /growth cohorts is invalid/);
  assert.throws(() => parseBusinessDashboard({ ...base, alerts: [{ key: "x", severity: "notice", message: "bad" }] }), /alert is invalid/);
});
