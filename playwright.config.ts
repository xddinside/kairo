import { defineConfig } from "@playwright/test";

const baseURL = "https://kairo.localhost";

export default defineConfig({
  testDir: "./test/browser",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile-320x568", use: { viewport: { width: 320, height: 568 } } },
    { name: "mobile-360x800", use: { viewport: { width: 360, height: 800 } } },
    { name: "tablet-768x1024", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop-1280x800", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "bun run dev",
    url: `${baseURL}/canvas`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
