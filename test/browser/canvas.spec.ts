import { expect, test } from "@playwright/test";

test("signed-out Users reach sign-in without horizontal overflow", async ({ page }) => {
  await page.goto("/canvas");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page).toHaveTitle(/Sign in · Kairo/);
  await expect(page.locator("main")).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});
