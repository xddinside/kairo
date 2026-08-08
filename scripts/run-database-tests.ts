import { spawnSync } from "node:child_process";
import { env, exit } from "node:process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import EmbeddedPostgres from "embedded-postgres";

import { isIsolatedDatabaseTestUrl } from "../src/server/database-contract";
import { runMigrations } from "../src/server/database/migrate";
import { Effect } from "effect";

const databaseTestUrl = env.KAIRO_DATABASE_TEST_URL;

const run = async (): Promise<number> => {
  if (databaseTestUrl !== undefined && databaseTestUrl.trim() !== "") {
    if (!isIsolatedDatabaseTestUrl(databaseTestUrl)) {
      console.error("Database tests refused: KAIRO_DATABASE_TEST_URL is not an isolated test/preview URL.");
      return 1;
    }
    return spawnSync("vitest", ["run", "test/database"], { stdio: "inherit", env: { ...env, KAIRO_DATABASE_TEST_URL: databaseTestUrl } }).status ?? 1;
  }

  const directory = await mkdtemp(join(tmpdir(), "kairo-postgres-"));
  const port = 55432;
  const embedded = new EmbeddedPostgres({ databaseDir: directory, user: "postgres", password: "postgres", port, persistent: false, onLog: () => undefined, onError: () => undefined });
  const database = "kairo_test";
  const migrator = "kairo_migrator";
  const runtime = "kairo_runtime";
  try {
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase(database);
    const admin = embedded.getPgClient(database);
    await admin.connect();
    await admin.query("CREATE TABLE prior_unrelated (id integer primary key, value text not null)");
    await admin.query("INSERT INTO prior_unrelated VALUES (1, 'preserved')");
    await admin.query(`CREATE ROLE ${migrator} LOGIN PASSWORD 'migrator'`);
    await admin.query(`CREATE ROLE ${runtime} LOGIN PASSWORD 'runtime'`);
    await admin.query(`GRANT SELECT ON prior_unrelated TO ${migrator}`);
    await admin.query(`ALTER DATABASE ${database} OWNER TO ${migrator}`);
    await admin.end();

    const migrationUrl = `postgresql://${migrator}:migrator@127.0.0.1:${port}/${database}`;
    await Effect.runPromise(runMigrations(migrationUrl, "test", migrator));

    const owner = postgres(migrationUrl, { max: 1, prepare: false });
    await owner.unsafe(`GRANT USAGE ON SCHEMA public TO ${runtime}`);
    await owner.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${runtime}`);
    await owner.unsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${runtime}`);
    await owner.end();

    const runtimeUrl = `postgresql://${runtime}:runtime@127.0.0.1:${port}/${database}`;
    const adminUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/${database}`;
    const result = spawnSync("vitest", ["run", "test/database"], { stdio: "inherit", env: { ...env, KAIRO_DATABASE_TEST_URL: runtimeUrl, KAIRO_DATABASE_MIGRATION_URL: migrationUrl, KAIRO_DATABASE_ADMIN_URL: adminUrl } });
    return result.status ?? 1;
  } catch (error) {
    console.error("Embedded PostgreSQL database harness failed:", error);
    return 1;
  } finally {
    await embedded.stop().catch(() => undefined);
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
};

exit(await run());
