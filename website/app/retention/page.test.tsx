import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import RetentionPage from "./page";

test("retention policy describes the implemented conditional cleanup boundary", () => {
  const html = renderToStaticMarkup(<RetentionPage />);
  assert.match(html, /30 days/i);
  assert.match(html, /enabled/i);
  assert.match(html, /effective date/i);
  assert.match(html, /created on or after/i);
  assert.match(html, /local (?:device )?copies/i);
  assert.match(html, /service provider|legal/i);
});
