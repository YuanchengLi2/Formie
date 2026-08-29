import assert from "node:assert/strict"; import test from "node:test"; import { parseDashboardSnapshot } from "./dashboard-data"; import { rawDashboardSnapshot } from "./dashboard-test-fixture";
test("validates complete metric wrappers and filter metadata", () => { const snapshot=parseDashboardSnapshot(rawDashboardSnapshot); assert.equal(snapshot.headline.newSignups.value,42); assert.equal(snapshot.headline.estimatedMrr.quality,"estimated"); assert.equal(snapshot.cohorts.northStar.denominator,25); assert.equal(snapshot.filters.exerciseOptions[0]?.label,"Back Squat"); });
test("rejects malformed, non-finite, and contradictory metrics", () => { assert.throws(()=>parseDashboardSnapshot(null),/snapshot/i); assert.throws(()=>parseDashboardSnapshot({...rawDashboardSnapshot,headline:{...rawDashboardSnapshot.headline,newSignups:{...rawDashboardSnapshot.headline.newSignups,value:Number.NaN}}}),/newSignups/i); assert.throws(()=>parseDashboardSnapshot({...rawDashboardSnapshot,headline:{...rawDashboardSnapshot.headline,helpfulRate:{...rawDashboardSnapshot.headline.helpfulRate,numerator:11,denominator:10}}}),/contradictory/i); });
test("accepts count ratios whose numerator exceeds the denominator", () => {
  const snapshot = parseDashboardSnapshot({
    ...rawDashboardSnapshot,
    headline: {
      ...rawDashboardSnapshot.headline,
      analysesPerActiveUser: {
        ...rawDashboardSnapshot.headline.analysesPerActiveUser,
        value: 2.5,
        numerator: 5,
        denominator: 2,
      },
    },
  });

  assert.equal(snapshot.headline.analysesPerActiveUser.value, 2.5);
});
