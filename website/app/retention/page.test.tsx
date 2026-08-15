import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import RetentionPage from "./page";

test("retention explains implemented deletion controls and external limits", () => {
  const html = renderToStaticMarkup(<RetentionPage />);
  assert.match(html, /Settings &gt; Delete Account/i);
  assert.match(html, /permanently deletes|permanent deletion/i);
  assert.match(html, /delete (?:an|individual) analysis/i);
  assert.match(html, /processor|legal records/i);
  assert.match(html, /does not cancel (?:your )?Apple subscription/i);
  assert.match(html, /href="\/privacy-choices"/i);
});
