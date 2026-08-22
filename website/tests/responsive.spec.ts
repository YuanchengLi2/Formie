import { expect, test } from "@playwright/test";

const routes = ["/", "/support", "/privacy", "/privacy-choices", "/retention", "/terms"];

for (const route of routes) {
  test(`${route} stays inside the viewport with reachable controls`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const controls = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled])')].map((element) => {
      element.focus();
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { x: box.x, right: box.right, width: box.width, outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth) || 0 };
    }));
    for (const [index, control] of controls.entries()) {
      expect(control.width, `focusable ${index} on ${route} has geometry`).toBeGreaterThan(0);
      expect(control.x).toBeGreaterThanOrEqual(-0.5);
      expect(control.right).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 0.5);
      expect(control.outlineStyle).not.toBe("none");
      expect(control.outlineWidth).toBeGreaterThan(0);
    }
  });
}

test("landing anchors remain present and reachable", async ({ page }) => {
  await page.goto("/");
  for (const id of ["hero", "how-it-works", "coaching", "pricing"]) {
    const section = page.locator(`#${id}`);
    await expect(section).toBeVisible();
    await section.scrollIntoViewIfNeeded();
    const box = await section.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-0.5);
    expect(box!.x + box!.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 0.5);
  }
});

test("the nonce-protected support form hydrates and remains interactive", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /content security policy|hydration/i.test(message.text())) violations.push(message.text());
  });
  await page.goto("/support");
  await page.getByLabel("Email").fill("sandbox@example.com");
  await page.getByLabel("Message").fill("This is a browser hydration check with enough detail to pass client validation.");
  await expect(page.getByLabel("Email")).toHaveValue("sandbox@example.com");
  expect(violations).toEqual([]);
});

for (const [route, hash] of [["/how-it-works", "#how-it-works"], ["/coaching", "#coaching"], ["/pricing", "#pricing"]] as const) {
  test(`${route} redirects to ${hash}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/${hash}$`));
    await expect(page.locator(hash)).toBeVisible();
  });
}
