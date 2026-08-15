import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("dashboard subdomain root resolves to founder login without changing the public site", () => {
  const config = readFileSync(resolve(__dirname, "../../vercel.json"), "utf8");
  assert.match(config, /dashboard\.useformie\.app/i);
  assert.match(config, /"destination"\s*:\s*"\/admin"/i);
  assert.match(config, /"source"\s*:\s*"\/"/i);
});
