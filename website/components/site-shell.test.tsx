import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SiteFooter, SiteHeader } from "./site-shell";

test("footer makes privacy choices discoverable", () => {
  const html = renderToStaticMarkup(<SiteFooter />);
  assert.match(html, /href="\/privacy-choices"[^>]*>Privacy Choices</i);
});

test("site navigation makes the access directory discoverable", () => {
  const header = renderToStaticMarkup(<SiteHeader />);
  const footer = renderToStaticMarkup(<SiteFooter />);
  assert.match(header, /href="\/login"[^>]*>Access</i);
  assert.match(footer, /href="\/login"[^>]*>Access</i);
});
