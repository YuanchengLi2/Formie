import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "./page";

test("homepage preserves section order and uses the new header and pricing", () => {
  const html = renderToStaticMarkup(<HomePage />);
  const ids = ["hero", "how-it-works", "coaching", "pricing"];
  ids.forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  const positions = ids.map((id) => html.indexOf(`id="${id}"`));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.equal((html.match(/<section\b/g) ?? []).length, 4);
  assert.match(html, /four whole-lift corrections/i);
  assert.match(html, /What happened/i);
  assert.match(html, /Why it matters/i);
  assert.match(html, /What to do next/i);
  assert.match(html, /\$9\.99/i);
  assert.match(html, /\$99\.99/i);
  assert.match(html, /Save 17%/i);
  assert.match(html, /10 analyses\/month/i);
  assert.match(html, /\/ month/i);
  assert.match(html, /10 complete analyses each month/i);
  assert.match(html, /Whole-set movement breakdowns/i);
  assert.match(html, /Visible evidence and timestamps/i);
  assert.match(html, /download-on-app-store\.svg/i);
  assert.equal((html.match(/Manage Subscription/g) ?? []).length, 1);
  assert.match(html, />How it works</i);
  assert.match(html, />Coaching</i);
  assert.match(html, />Pricing</i);
  assert.match(html, /formie-hero-product-v4\.png/);
  assert.match(html, /formie-coaching-product-v4\.png/);
});

test("document and responsive artwork stay bounded", () => {
  const globalCss = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
  const css = readFileSync(new URL("./landing-v2.css", import.meta.url), "utf8");
  assert.doesNotMatch(globalCss, /(?:html|body)[^{]*\{[^}]*overflow-x:\s*hidden/);
  assert.match(globalCss, /html\s*\{[^}]*overflow-x:\s*clip/);
  assert.match(globalCss, /body\s*\{[^}]*overflow-x:\s*clip/);
  for (const selector of [".v2-hero-art", ".v2-journey-image", ".v2-pro-visual"]) {
    const rules = [...css.matchAll(new RegExp(`${selector.replace(".", "\\.")}[^\\{]*\\{([^}]+)\\}`, "g"))].map((match) => match[1]).join("\n");
    assert.doesNotMatch(rules, /width:\s*(?:1(?:0[1-9]|[1-9]\d)|[2-9]\d{2,})%/);
    assert.doesNotMatch(rules, /margin-left:\s*-/);
  }
});

test("pricing card is upright and proportionate across breakpoints", () => {
  const css = readFileSync(new URL("./landing-v2.css", import.meta.url), "utf8");
  const rules = css.match(/\.v2-pro-card\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.match(rules, /width:\s*clamp\(440px,\s*34vw,\s*480px\)/);
  assert.match(rules, /max-width:\s*100%/);
  assert.match(rules, /transform:\s*none/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.v2-pro-card\s*\{[^}]*width:\s*calc\(100% - 36px\)/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.v2-plan-options\s*\{[^}]*grid-template-columns:\s*1fr/);
});

test("320px header reserves space for brand, portal, and App Store badge", () => {
  const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
  assert.match(css, /\.site-header\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*\.8[0-9]\)/);
  assert.match(css, /\.app-store-badge\.disabled\s*\{[^}]*opacity:\s*1/);
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?\.site-header nav\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /@media \(max-width:\s*360px\)[\s\S]*?\.site-header nav\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.app-store-badge\s*\{[^}]*width:\s*120px/);
});

test("hero artwork remains inside its own grid track", () => {
  const css = readFileSync(new URL("./landing-v2.css", import.meta.url), "utf8");
  const heroArt = css.match(/\.v2-hero-art\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.match(heroArt, /width:\s*100%/);
  assert.match(heroArt, /max-width:\s*100%/);
  assert.doesNotMatch(heroArt, /vw/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.v2-hero-art\s*\{[^}]*margin-top:\s*0[^}]*transform:\s*none/);
  assert.doesNotMatch(css, /\.v2-hero-art::after/);
  assert.match(css, /\.v2-hero::after\s*\{[^}]*linear-gradient/);
});
