import postgres from "postgres";
import { Effect, Schema } from "effect";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";

import { isIsolatedDatabaseTestUrl } from "../database-contract";

export class MigrationBoundaryError extends Schema.TaggedError<MigrationBoundaryError>()("Kairo.MigrationBoundaryError", { message: Schema.String }) {}

export const runMigrations = Effect.fn("Database.migrate")(function* (url: string | URL, environment: "local" | "test" | "ci" | "preview" | "production", expectedRole: string) {
  if (expectedRole.trim() === "") return yield* new MigrationBoundaryError({ message: "Migration role is required" });
  if (environment !== "production" && !isIsolatedDatabaseTestUrl(String(url))) {
    return yield* new MigrationBoundaryError({ message: "Non-production migrations require an isolated local/test/preview URL" });
  }
  const client = postgres(String(url), { max: 1, prepare: false });
  try {
    const role = yield* Effect.tryPromise({ try: () => client`select current_user as role`, catch: () => new MigrationBoundaryError({ message: "Could not verify migration role" }) });
    if (role[0]?.role !== expectedRole) return yield* new MigrationBoundaryError({ message: "Direct database connection is not the configured migration role" });
    yield* Effect.tryPromise({
      try: () => migrate(drizzle(client), { migrationsFolder: "drizzle" }),
      catch: (cause) => new MigrationBoundaryError({ message: cause instanceof Error ? cause.message : "Migration failed" }),
    });
  } finally {
    yield* Effect.promise(() => client.end({ timeout: 5 }).then(() => undefined));
  }
});
