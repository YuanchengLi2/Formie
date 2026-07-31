import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import HomePage from "./page";

test("the homepage ends with the smaller pricing section after the coaching preview", () => {
  const html = renderToStaticMarkup(<HomePage />);

  for (const sectionId of ["hero", "how-it-works", "coaching", "pricing"]) {
    assert.match(html, new RegExp(`id="${sectionId}"`));
  }
  const positions = ["hero", "how-it-works", "coaching", "pricing"].map((id) => html.indexOf(`id="${id}"`));
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
  assert.equal((html.match(/<section\b/g) ?? []).length, 4);
  assert.doesNotMatch(html, /id="setup-guide"|id="support"/i);
  assert.doesNotMatch(html, /id="analysis"|id="progress"/i);
  assert.doesNotMatch(html, /sample analysis|full-set analysis/i);
  assert.match(html, /four whole-lift corrections/i);
  assert.match(html, /stance, distance, posture, lean, grip, load, equipment, balance, safety, and movement/i);
  assert.match(html, /four is the minimum, not the limit/i);
  assert.match(html, /What happened/i);
  assert.match(html, /Why it matters/i);
  assert.match(html, /What to do next/i);
  assert.doesNotMatch(html, /AI movement coaching from one recorded set/i);
  assert.match(html, /10 analyses\. \$10\./i);
  assert.match(html, /10 complete form analyses/i);
  assert.match(html, /Deeper coaching breakdowns/i);
  assert.match(html, /More access to Formie Coach/i);
  assert.match(html, /Early access to premium features/i);
  assert.match(html, /Priority support/i);
  assert.match(html, /Coming to the App Store/i);
  assert.match(html, /App Store — Soon/i);
  assert.doesNotMatch(html, /\$9\.99|\/month/i);
  assert.match(html, /formie-hero-product-v4\.png/);
  assert.doesNotMatch(html, /formie-hero-product-v3\.png/);
  assert.match(html, /formie-coaching-product-v4\.png/);
  assert.match(html, /class="v2-coaching-art"/);
  assert.doesNotMatch(html, /v2-coaching-preview|v2-preview-video|v2-lifter/);
});

test("the sticky header is not trapped by a document overflow container", () => {
  const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(css, /(?:html|body)[^{]*\{[^}]*overflow-x:\s*hidden/);
  assert.match(css, /html\s*\{[^}]*overflow-x:\s*clip/);
  assert.match(css, /body\s*\{[^}]*overflow-x:\s*clip/);
});

test("responsive artwork stays bounded by its component canvas", () => {
  const css = readFileSync(new URL("./landing-v2.css", import.meta.url), "utf8");

  for (const selector of [".v2-hero-art", ".v2-journey-image", ".v2-pro-visual"]) {
    const rules = [...css.matchAll(new RegExp(`${selector.replace(".", "\\.")}[^\\{]*\\{([^}]+)\\}`, "g"))]
      .map((match) => match[1])
      .join("\n");
    assert.doesNotMatch(rules, /width:\s*(?:1(?:0[1-9]|[1-9]\d)|[2-9]\d{2,})%/);
    assert.doesNotMatch(rules, /margin-left:\s*-/);
  }
});

test("product artwork blends into the background of its section", () => {
  const css = readFileSync(new URL("./landing-v2.css", import.meta.url), "utf8");

  assert.match(css, /--v2-cream:\s*#fff;/);
  assert.doesNotMatch(css, /rgba\(245,\s*240,\s*231/);
  assert.match(css, /\.v2-hero\s*\{[^}]*linear-gradient\(to bottom,[^}]*var\(--v2-black\)/s);
  assert.match(css, /\.v2-hero-art img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(css, /\.v2-coaching-art\s*\{[^}]*background:\s*var\(--v2-black\)/s);
  assert.match(css, /\.v2-coaching-art img\s*\{[^}]*object-fit:\s*contain/s);
});

test("mobile product artwork is enlarged without widening the page", () => {
  const css = readFileSync(new URL("./landing-v2.css", import.meta.url), "utf8");
  const mobileRules = css.slice(css.indexOf("@media (max-width: 760px)"));

  assert.match(mobileRules, /\.v2-hero-art\s*\{[^}]*width:\s*100%[^}]*transform:\s*scale\(1\.12\)/s);
  assert.match(mobileRules, /\.v2-coaching-art\s*\{[^}]*width:\s*100%[^}]*transform:\s*scale\(1\.28\)/s);
  assert.match(mobileRules, /@media \(max-width:\s*430px\)[\s\S]*?\.v2-hero h1\s*\{[^}]*font-size:\s*clamp\(2\.1rem,\s*9\.6vw,\s*2\.7rem\)/s);
  assert.match(mobileRules, /@media \(max-width:\s*430px\)[\s\S]*?\.site-header\s*\{[^}]*gap:\s*12px[^}]*padding:\s*14px 16px/s);
});
