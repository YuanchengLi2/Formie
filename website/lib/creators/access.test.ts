import assert from "node:assert/strict";
import test from "node:test";
import { CreatorAccessError, verifyCreator } from "./access";

function client(authError: unknown = null, membershipError: unknown = null, active = true) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "creator-user" } }, error: authError }) },
    rpc: async () => ({ data: [{ creator_id: "creator-one", status: active ? "active" : "inactive" }], error: membershipError }),
  } as unknown as Parameters<typeof verifyCreator>[0];
}

test("temporary creator auth and membership failures remain retryable without a login redirect", async () => {
  const outage = Object.assign(new Error("service unavailable"), { status: 503 });
  await assert.rejects(verifyCreator(client(outage)), (error) => error === outage && !(error instanceof CreatorAccessError));
  await assert.rejects(verifyCreator(client(null, outage)), (error) => error === outage && !(error instanceof CreatorAccessError));
});

test("invalid sessions and inactive memberships still deny creator access", async () => {
  await assert.rejects(verifyCreator(client(Object.assign(new Error("expired"), { status: 401 }))), CreatorAccessError);
  await assert.rejects(verifyCreator(client(null, null, false)), CreatorAccessError);
  assert.equal((await verifyCreator(client())).creatorId, "creator-one");
});
