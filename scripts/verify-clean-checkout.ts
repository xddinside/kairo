import { spawnSync } from "node:child_process";
import { exit } from "node:process";

const result = spawnSync("git", ["diff", "--exit-code", "--", "."], { stdio: "inherit" });
const status = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
const isClean = result.status === 0 && status.status === 0 && status.stdout.trim() === "";

if (isClean) {
  console.log("Clean-checkout verification passed: tracked files did not change during verification.");
} else {
  console.error("Clean-checkout verification failed: tracked or untracked files changed during verification.");
}

exit(isClean ? 0 : 1);
