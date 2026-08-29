import assert from "node:assert/strict"; import test from "node:test";
import { createLiveRefreshController } from "./live-refresh";
test("keeps the last good snapshot when a refresh fails and cancels superseded requests", async () => {
  const states: Array<{ stale: boolean; value: number }> = []; let call = 0;
  const controller = createLiveRefreshController({ initial: { value: 1 }, load: async () => { call += 1; if (call === 1) throw new Error("offline"); return { value: 2 }; }, publish: (state) => states.push({ stale: state.stale, value: state.snapshot.value }) });
  await controller.refresh(); assert.deepEqual(states.at(-1), { stale: true, value: 1 });
  await controller.refresh(); assert.deepEqual(states.at(-1), { stale: false, value: 2 });
  controller.dispose();
});
