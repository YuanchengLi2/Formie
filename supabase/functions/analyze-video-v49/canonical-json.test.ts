import { canonicalJson, canonicalSha256 } from "./canonical-json";

it("produces the same canonical representation for reordered object keys", async () => {
  expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 4 }, b: 2 }));
  await expect(canonicalSha256({ b: 2, a: 1 })).resolves.toBe(await canonicalSha256({ a: 1, b: 2 }));
});

it("preserves array order", () => {
  expect(canonicalJson({ values: [1, 2] })).not.toBe(canonicalJson({ values: [2, 1] }));
});
