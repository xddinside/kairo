import { execFileSync } from "node:child_process";
import { env } from "node:process";

import { Effect } from "effect";

import { releaseRecordFields, validateReleaseRecord } from "../src/server/release";

const commit = (env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" })).trim();
const pendingFields = Object.fromEntries(
  releaseRecordFields
    .filter((field) => field !== "release_id" && field !== "commit" && field !== "environment" && field !== "runtime_node_version")
    .map((field) => [field, "pending"]),
);
const record = {
  release_id: commit,
  commit,
  environment: env.KAIRO_ENV ?? "ci",
  runtime_node_version: process.versions.node,
  ...pendingFields,
};

const result = await Effect.runPromiseExit(validateReleaseRecord(record));

if (result._tag === "Failure") {
  console.error("Release metadata validation failed; no release record was published.");
  process.exit(1);
}

console.log(`Release metadata contract valid for ${commit}. Downstream gate fields remain pending.`);
