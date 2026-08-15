import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SiteFooter } from "./site-shell";

test("footer makes privacy choices discoverable", () => {
  const html = renderToStaticMarkup(<SiteFooter />);
  assert.match(html, /href="\/privacy-choices"[^>]*>Privacy Choices</i);
});
