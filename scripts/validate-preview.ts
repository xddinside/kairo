import { env, exit } from "node:process";

import { Effect } from "effect";

import { validatePreviewIsolation } from "../src/server/preview-isolation";

const mode = env.KAIRO_ENV ?? "local";
const values = {
  previewId: env.KAIRO_PREVIEW_ID,
  origin: env.KAIRO_ORIGIN,
  databaseUrl: env.PREVIEW_DATABASE_URL,
  storageEndpoint: env.PREVIEW_STORAGE_ENDPOINT,
  storageBucket: env.PREVIEW_STORAGE_BUCKET,
  productionOrigin: env.KAIRO_PRODUCTION_ORIGIN,
  productionDatabaseUrl: env.KAIRO_PRODUCTION_DATABASE_URL,
  productionStorageBucket: env.KAIRO_PRODUCTION_STORAGE_BUCKET,
};
const hasPreviewInput = Object.values(values).some((value) => value !== undefined && value !== "");

if (mode === "local" && !hasPreviewInput) {
  console.log("SKIP preview isolation: set KAIRO_ENV=preview or provide preview variables to validate them.");
  exit(0);
}

if (mode !== "preview" && mode !== "ci") {
  console.error("Preview isolation refused: KAIRO_ENV must be preview or ci when preview variables are supplied.");
  exit(1);
}

const result = await Effect.runPromiseExit(validatePreviewIsolation(values));

if (result._tag === "Failure") {
  console.error("Preview isolation failed closed. Check the named isolation fields; no secret values were printed.");
  exit(1);
}

console.log(`Preview isolation contract valid for ${mode}; production resources were not selected.`);
