import { expect, test } from "@playwright/test";

test("Canvas renders without horizontal overflow", async ({ page }) => {
  await page.goto("/canvas");
  await expect(page).toHaveTitle(/Canvas · Kairo/);

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});
