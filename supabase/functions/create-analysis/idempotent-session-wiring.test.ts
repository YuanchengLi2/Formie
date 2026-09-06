import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("create-analysis idempotent session wiring", () => {
  it("returns an existing request without resetting its durable analysis state", () => {
    const source = readFileSync(resolve(__dirname, "index.ts"), "utf8");

    expect(source).toContain('.eq("client_request_id", clientRequestId)');
    expect(source).toContain("if (existing?.id) return");
    expect(source).toContain('.insert({');
    expect(source).toContain('error.code === "23505"');
    expect(source).not.toContain('.upsert({');
  });
});
