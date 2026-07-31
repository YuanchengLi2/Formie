import assert from "node:assert/strict";
import test from "node:test";

import { parseSupportRequest } from "./support-request";

const validRequest = {
  name: "Jamie",
  email: "jamie@example.com",
  category: "account",
  message: "I need help updating the email on my Formie account.",
  website: "",
};

test("normalizes a valid support request", () => {
  assert.deepEqual(parseSupportRequest(validRequest), validRequest);
});

test("requires a valid email, category, and a 20-2,000 character message", () => {
  for (const value of [
    { ...validRequest, email: "not-an-email" },
    { ...validRequest, category: "unknown" },
    { ...validRequest, message: "Too short" },
    { ...validRequest, message: "x".repeat(2001) },
  ]) {
    assert.throws(() => parseSupportRequest(value), /INVALID_SUPPORT_REQUEST/);
  }
});

test("rejects honeypot submissions and unexpected browser fields", () => {
  assert.throws(
    () => parseSupportRequest({ ...validRequest, website: "https://spam.example" }),
    /INVALID_SUPPORT_REQUEST/,
  );
  assert.throws(
    () => parseSupportRequest({ ...validRequest, ip: "203.0.113.10" }),
    /INVALID_SUPPORT_REQUEST/,
  );
});
