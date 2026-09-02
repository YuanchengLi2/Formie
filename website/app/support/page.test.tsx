import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import SupportPage from "./page";

test("renders a standalone support form with the required fields and no attachment control", () => {
  const html = renderToStaticMarkup(<SupportPage />);

  assert.match(html, /Contact Formie support/i);
  assert.match(html, /name="email"/);
  assert.match(html, /name="category"/);
  assert.match(html, /name="message"/);
  assert.match(html, /name="name"/);
  assert.match(html, /name="website"/);
  assert.match(html, /support@useformie\.com/i);
  assert.doesNotMatch(html, /type="file"/);
  assert.doesNotMatch(html, /automatic confirmation|confirmation email/i);
});
