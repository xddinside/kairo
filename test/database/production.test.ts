import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { Effect, Layer } from "effect";
import { sql } from "drizzle-orm";

import { databaseLayer, makeDatabaseService } from "../../src/server/database/service";
import { DomainCommands } from "../../src/server/domain/commands";
import { productionDomainCommandsLayer } from "../../src/server/domain/sql-commands";
import { requireUserFromSession } from "../../src/server/auth/user";
const url = process.env.KAIRO_DATABASE_TEST_URL;
const migrationUrl = process.env.KAIRO_DATABASE_MIGRATION_URL;
const adminUrl = process.env.KAIRO_DATABASE_ADMIN_URL;
const run = describe.skipIf(!url || !migrationUrl);

const privateTables = [
  "users", "courses", "tasks", "assessments", "timetable_entries", "timetable_entry_exceptions", "notes", "files", "file_chunks", "file_processing_jobs", "canvases", "canvas_activities", "generated_views", "canvas_operations", "focus_sessions", "notification_preferences", "notification_events", "browser_subscriptions", "notification_deliveries", "domain_commands", "undo_tokens", "outbox_jobs", "export_jobs", "deletion_jobs",
];

let db: ReturnType<typeof postgres>;
let migrationDb: ReturnType<typeof postgres>;

run("production PostgreSQL migration and RLS proof", () => {
  beforeAll(async () => {
    db = postgres(url!, { max: 2, prepare: false });
    migrationDb = postgres(migrationUrl!, { max: 1, prepare: false });
    await db.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', 'user_alice', true)`;
      await tx`insert into users (id, time_zone) values ('user_alice', 'America/New_York')`;
    });
    await db.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', 'user_bob', true)`;
      await tx`insert into users (id, time_zone) values ('user_bob', 'UTC')`;
    });
  });

  afterAll(async () => {
    await migrationDb?.end({ timeout: 5 });
    await db?.end({ timeout: 5 });
  });

  it("migrates the empty shape and preserves an unrelated prior table", async () => {
    const tables = await db`select to_regclass('public.tasks') as tasks, to_regclass('public.prior_unrelated') as prior`;
    expect(tables[0]?.tasks).toBe("tasks");
    expect(tables[0]?.prior).toBe("prior_unrelated");
    const prior = await migrationDb`select * from prior_unrelated`;
    expect(prior).toEqual([{ id: 1, value: "preserved" }]);
  });

  it("uses a non-owner runtime role that cannot bypass RLS", async () => {
    const role = await db`select current_user as role, r.rolsuper, r.rolbypassrls from pg_roles r where r.rolname = current_user`;
    expect(role[0]?.rolsuper).toBe(false);
    expect(role[0]?.rolbypassrls).toBe(false);
    await expect(db.unsafe("alter table tasks disable row level security")).rejects.toBeDefined();
    await expect(db.begin(async (tx) => tx.unsafe("set local row_security = off"))).resolves.toBeDefined();
  });

  it("uses the Effect Database seam to set transaction-local identity", async () => {
    const service = makeDatabaseService(url!, { runtimeRole: "kairo_runtime", migrationRole: "kairo_migrator" });
    expect(await Effect.runPromise(service.healthcheck())).toBe("ready");
    const alice = requireUserFromSession({ _tag: "verified", userId: "user_alice", sessionId: "sess_alice" });
    const identity = await Effect.runPromise(service.withTransaction(alice, async (tx) => {
      const rows = await tx.execute<{ current_user_id: string }>(sql`select current_setting('app.current_user_id', true) as current_user_id`);
      return rows[0]?.current_user_id;
    }));
    expect(identity).toBe("user_alice");
    await Effect.runPromise(service.close());
  });

  it("rejects missing, equal, wrong, owner, and superuser runtime boundaries", async () => {
    const boundaries = [
      { runtimeRole: "", migrationRole: "kairo_migrator" },
      { runtimeRole: "kairo_runtime", migrationRole: "kairo_runtime" },
      { runtimeRole: "wrong_runtime", migrationRole: "kairo_migrator" },
      { runtimeRole: "kairo_migrator", migrationRole: "other_migrator" },
    ];
    for (const boundary of boundaries) {
      const service = makeDatabaseService(url!, boundary);
      const result = await Effect.runPromiseExit(service.healthcheck());
      expect(result._tag).toBe("Failure");
      await Effect.runPromise(service.close());
    }
    if (adminUrl) {
      const service = makeDatabaseService(adminUrl, { runtimeRole: "postgres", migrationRole: "kairo_migrator" });
      const result = await Effect.runPromiseExit(service.healthcheck());
      expect(result._tag).toBe("Failure");
      await Effect.runPromise(service.close());
    }
  });

  it("has forced owner policies on every private table", async () => {
    const rows = await db`
      select c.relname, c.relforcerowsecurity, exists (
        select 1 from pg_policies p where p.tablename = c.relname and p.policyname = 'kairo_owner_policy'
      ) as has_policy
      from pg_class c where c.relname = any(${db.array(privateTables)})
    `;
    expect(rows).toHaveLength(privateTables.length);
    for (const row of rows) {
      expect(row.relforcerowsecurity).toBe(true);
      expect(row.has_policy || row.relname === "users").toBe(true);
    }
  });

  it("isolates two Users and rejects omitted or forged owner scope", async () => {
    const policy = await migrationDb`select qual, with_check from pg_policies where tablename = 'courses'`;
    if (!policy[0]) throw new Error(JSON.stringify(policy));
    expect(policy[0]?.with_check).toBe("(owner_id = NULLIF(current_setting('app.current_user_id'::text, true), ''::text))");
    const aliceRows = await db.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', 'user_alice', true)`;
      const identity = await tx`select current_setting('app.current_user_id', true) as value`;
      expect(identity[0]?.value).toBe("user_alice");
      const check = await tx`select ('user_alice' = nullif(current_setting('app.current_user_id', true), '')) as allowed`;
      expect(check[0]?.allowed).toBe(true);
      await tx`insert into courses (owner_id, title) values ('user_alice', 'Algebra')`;
      return tx`insert into tasks (owner_id, title) values ('user_alice', 'Alice task') returning id`;
    });
    const taskId = aliceRows[0]!.id;
    const hidden = await db.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', 'user_bob', true)`;
      return tx`select id from tasks where id = ${taskId}`;
    });
    expect(hidden).toEqual([]);
    await expect(db.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', 'user_alice', true)`;
      await tx`insert into tasks (owner_id, title) values ('user_bob', 'forged')`;
    })).rejects.toBeDefined();
    const noIdentity = await db`select id from tasks`;
    expect(noIdentity).toEqual([]);
  });

  it("enforces same-owner foreign keys and rolls back failed transactions", async () => {
    const bobCourse = await db.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', 'user_bob', true)`;
      return tx`insert into courses (owner_id, title) values ('user_bob', 'Biology') returning id`;
    });
    const aliceCourse = await db.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', 'user_alice', true)`;
      return tx`select id from courses where owner_id = 'user_alice' limit 1`;
    });
    await expect(db.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', 'user_bob', true)`;
      await tx`insert into tasks (owner_id, title, course_id) values ('user_bob', 'foreign link', ${aliceCourse[0]!.id})`;
    })).rejects.toBeDefined();
    const rollbackId = "00000000-0000-4000-8000-000000000001";
    await expect(db.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', 'user_bob', true)`;
      await tx`insert into tasks (id, owner_id, title) values (${rollbackId}, 'user_bob', 'rolled back')`;
      throw new Error("force rollback");
    })).rejects.toThrow("force rollback");
    const absent = await db.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', 'user_bob', true)`;
      return tx`select id from tasks where id = ${rollbackId}`;
    });
    expect(absent).toEqual([]);
    expect(bobCourse[0]?.id).toBeDefined();
  });

  it("executes and persists SQL Domain commands and one-use Undo", async () => {
    const service = makeDatabaseService(url!, { runtimeRole: "kairo_runtime", migrationRole: "kairo_migrator" });
    const commandsLayer = Layer.provide(productionDomainCommandsLayer, databaseLayer(service));
    const execute = (user: ReturnType<typeof requireUserFromSession>, input: unknown) =>
      Effect.runPromise(DomainCommands.use((commands) => commands.execute(user, input)).pipe(Effect.provide(commandsLayer)));
    const alice = requireUserFromSession({ _tag: "verified", userId: "user_alice", sessionId: "sess_alice" });
    const bob = requireUserFromSession({ _tag: "verified", userId: "user_bob", sessionId: "sess_bob" });
    const created = await execute(alice, { version: 1, idempotencyKey: "sql-create", kind: "task.create", args: { title: "SQL task" } });
    expect(created._tag).toBe("applied");
    if (created._tag !== "applied" || !created.value || !created.undoToken) throw new Error("SQL create did not return a task and Undo token");
    const taskId = created.value.id;
    const retried = await execute(alice, { version: 1, idempotencyKey: "sql-create", kind: "task.create", args: { title: "SQL task" } });
    expect(retried._tag).toBe("already_applied");
    const malformed = await Effect.runPromiseExit(DomainCommands.use((commands) => commands.execute(alice, { version: 1, idempotencyKey: "sql-mismatch", kind: "task.create", args: { taskId, expectedVersion: 1, patch: { title: "wrong" } } })).pipe(Effect.provide(commandsLayer)));
    expect(malformed._tag).toBe("Failure");
    const edited = await execute(alice, { version: 1, idempotencyKey: "sql-edit", kind: "task.update", args: { taskId, expectedVersion: 1, patch: { title: "edited" } } });
    expect(edited._tag).toBe("applied");
    const stale = await execute(alice, { version: 1, idempotencyKey: "sql-stale", kind: "task.update", args: { taskId, expectedVersion: 1, patch: { title: "stale" } } });
    expect(stale).toMatchObject({ _tag: "conflict", reason: "stale_version" });
    expect(await execute(bob, { version: 1, idempotencyKey: "sql-foreign", kind: "task.update", args: { taskId, expectedVersion: 2, patch: { title: "foreign" } } })).toEqual({ _tag: "not_found" });
    expect(await execute(bob, { version: 1, idempotencyKey: "sql-missing", kind: "task.update", args: { taskId: "00000000-0000-4000-8000-000000000099", expectedVersion: 1, patch: { title: "missing" } } })).toEqual({ _tag: "not_found" });

    const assessmentId = "00000000-0000-4000-8000-000000000010";
    const dependentTaskId = "00000000-0000-4000-8000-000000000011";
    await db.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', 'user_alice', true)`;
      await tx`insert into assessments (id, owner_id, title) values (${assessmentId}, 'user_alice', 'SQL assessment')`;
      await tx`insert into tasks (id, owner_id, title, assessment_id) values (${dependentTaskId}, 'user_alice', 'dependent', ${assessmentId})`;
    });
    expect(await execute(alice, { version: 1, idempotencyKey: "sql-dependent-delete", kind: "academic.delete", args: { record: { kind: "assessment", id: assessmentId }, expectedVersion: 1 } })).toMatchObject({ _tag: "conflict", reason: "has_dependents" });

    const undoCreate = await execute(alice, { version: 1, idempotencyKey: "sql-undo-create", kind: "task.create", args: { title: "Undo me" } });
    if (undoCreate._tag !== "applied" || !undoCreate.value || !undoCreate.undoToken) throw new Error("SQL Undo setup failed");
    const undoToken = undoCreate.undoToken;
    expect(await execute(alice, { version: 1, idempotencyKey: "sql-undo", kind: "undo", args: { token: undoToken } })).toMatchObject({ _tag: "applied" });
    expect(await execute(alice, { version: 1, idempotencyKey: "sql-undo-reused", kind: "undo", args: { token: undoToken } })).toMatchObject({ _tag: "conflict", reason: "unsafe_undo" });
    expect(await execute(bob, { version: 1, idempotencyKey: "sql-undo-foreign", kind: "undo", args: { token: undoToken } })).toMatchObject({ _tag: "conflict", reason: "unsafe_undo" });

    const staleUndo = await execute(alice, { version: 1, idempotencyKey: "sql-stale-undo-create", kind: "task.create", args: { title: "Stale Undo" } });
    if (staleUndo._tag !== "applied" || !staleUndo.value || !staleUndo.undoToken) throw new Error("SQL stale Undo setup failed");
    await execute(alice, { version: 1, idempotencyKey: "sql-stale-undo-edit", kind: "task.update", args: { taskId: staleUndo.value.id, expectedVersion: 1, patch: { title: "Changed" } } });
    expect(await execute(alice, { version: 1, idempotencyKey: "sql-stale-undo", kind: "undo", args: { token: staleUndo.undoToken } })).toMatchObject({ _tag: "conflict", reason: "unsafe_undo" });

    const concurrent = await execute(alice, { version: 1, idempotencyKey: "sql-concurrent-create", kind: "task.create", args: { title: "Concurrent Undo" } });
    if (concurrent._tag !== "applied" || !concurrent.undoToken) throw new Error("SQL concurrent Undo setup failed");
    const concurrentResults = await Promise.all([
      execute(alice, { version: 1, idempotencyKey: "sql-concurrent-undo-a", kind: "undo", args: { token: concurrent.undoToken } }),
      execute(alice, { version: 1, idempotencyKey: "sql-concurrent-undo-b", kind: "undo", args: { token: concurrent.undoToken } }),
    ]);
    expect(concurrentResults.filter((result) => result._tag === "applied")).toHaveLength(1);
    expect(concurrentResults.filter((result) => result._tag === "conflict")).toHaveLength(1);
    const persisted = await db.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', 'user_alice', true)`;
      const commands = await tx`select count(*)::int as count from domain_commands where owner_id = 'user_alice' and idempotency_key = 'sql-create'`;
      const undo = await tx`select count(*)::int as count from undo_tokens where owner_id = 'user_alice' and token_hash is not null`;
      return { commands: commands[0]?.count, undo: undo[0]?.count };
    });
    expect(persisted.commands).toBe(1);
    expect(persisted.undo).toBeGreaterThan(0);
    await Effect.runPromise(service.close());
  });
});

if (!url || !migrationUrl) console.log("SKIP database execution tests: embedded harness or isolated URLs are required");
