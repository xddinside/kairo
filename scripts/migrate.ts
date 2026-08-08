import { Effect } from "effect";

import { runMigrations } from "../src/server/database/migrate";

const url = process.env.DIRECT_DATABASE_URL;
const environment = (process.env.KAIRO_ENV ?? "local") as "local" | "test" | "ci" | "preview" | "production";

if (!url) {
  console.error("Migration refused: DIRECT_DATABASE_URL is not set");
  process.exit(1);
}
const migrationRole = process.env.DATABASE_MIGRATION_ROLE;
if (!migrationRole) {
  console.error("Migration refused: DATABASE_MIGRATION_ROLE is not set");
  process.exit(1);
}

try {
  await Effect.runPromise(runMigrations(url, environment, migrationRole));
  console.log("Drizzle migrations applied through the direct migration boundary.");
} catch {
  console.error("Migration failed; no runtime database URL was used.");
  process.exit(1);
}
