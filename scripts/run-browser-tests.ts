import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { env, exit } from "node:process";

import { chromium } from "@playwright/test";

const executable = chromium.executablePath();

if (!existsSync(executable)) {
  console.log("SKIP browser tests: install the Playwright Chromium browser before running this suite.");
  exit(0);
}

const result = spawnSync("playwright", ["test"], {
  stdio: "inherit",
  env,
});
exit(result.status ?? 1);
