import assert from "node:assert/strict"; import test from "node:test"; import { renderToStaticMarkup } from "react-dom/server"; import { dashboardSnapshot } from "../../lib/admin/dashboard-test-fixture"; import { AdminDashboard } from "./admin-dashboard";
test("renders only the six core founder metrics",()=>{
  const html=renderToStaticMarkup(<AdminDashboard snapshot={dashboardSnapshot} adminEmail="founder@example.com" stale/>);

  for(const text of ["New signups","Recording → delivered","Analyses / active user","7-day repeat","Helpful analyses","Business health","Stale · retrying","All exercises"]) {
    assert.match(html,new RegExp(text,"i"));
  }
  for(const text of ["North star","14-day habit","Acquisition to repeat analysis","Usefulness by exercise","Reliability","Estimated economics"]) {
    assert.doesNotMatch(html,new RegExp(text,"i"));
  }
  assert.equal((html.match(/<article class="admin-metric/g) ?? []).length,6);
  assert.match(html,/incomplete/i);
});
