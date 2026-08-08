import postgres from "postgres";
import { Context, Effect, Layer, Option, Redacted, Schema, Schedule } from "effect";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

import type { AuthenticatedUser } from "../auth/user";
import { ServerConfig } from "../config";
import * as schema from "./schema";

export type KairoDb = PostgresJsDatabase<typeof schema>;
export type KairoTx = Parameters<Parameters<KairoDb["transaction"]>[0]>[0];

export class DatabaseUnavailable extends Schema.TaggedError<DatabaseUnavailable>()("Kairo.DatabaseUnavailable", {
  message: Schema.String,
  requestId: Schema.String,
  retryable: Schema.Boolean,
}) {}

export class UnsafeDatabaseExecution extends Schema.TaggedError<UnsafeDatabaseExecution>()("Kairo.UnsafeDatabaseExecution", {
  message: Schema.String,
}) {}

export interface DatabaseService {
  readonly healthcheck: () => Effect.Effect<"ready", DatabaseUnavailable | UnsafeDatabaseExecution>;
  readonly withTransaction: <A>(
    user: AuthenticatedUser,
    operation: (tx: KairoTx) => Promise<A>,
  ) => Effect.Effect<A, DatabaseUnavailable | UnsafeDatabaseExecution>;
  readonly close: () => Effect.Effect<void>;
}

export interface DatabaseRoleBoundary {
  readonly runtimeRole: string;
  readonly migrationRole: string;
}

export class Database extends Context.Service<Database, DatabaseService>()("kairo/server/Database") {}

const requestId = () => crypto.randomUUID();

const verifyRuntime = async (tx: KairoTx, boundary: DatabaseRoleBoundary): Promise<void> => {
  if (!boundary || boundary.runtimeRole.trim() === "" || boundary.migrationRole.trim() === "" || boundary.runtimeRole === boundary.migrationRole) {
    throw new UnsafeDatabaseExecution({ message: "Database runtime and migration roles must be distinct and configured" });
  }
  const rows = await tx.execute<{ role_name: string; is_superuser: boolean; rolbypassrls: boolean }>(sql`
    select current_user as role_name, r.rolsuper as is_superuser, r.rolbypassrls
    from pg_roles r where r.rolname = current_user
  `);
  const role = rows[0];
  const ownedTables = await tx.execute<{ count: string }>(sql`
    select count(*)::text as count
    from pg_class c
    join pg_roles owner on owner.oid = c.relowner
    join pg_namespace namespace on namespace.oid = c.relnamespace
    where namespace.nspname = 'public' and c.relkind = 'r' and owner.rolname = current_user
      and c.relname = any(array['users','courses','tasks','assessments','timetable_entries','notes','files','canvases','domain_commands','undo_tokens']::text[])
  `);
  if (!role || role.is_superuser || role.rolbypassrls || role.role_name !== boundary.runtimeRole || ownedTables[0]?.count !== "0") {
    throw new UnsafeDatabaseExecution({ message: "Database runtime role is permitted to bypass row security" });
  }
};

const setIdentity = async (tx: KairoTx, user: AuthenticatedUser): Promise<void> => {
  await tx.execute(sql`select set_config('app.current_user_id', ${user.id}, true)`);
  const rows = await tx.execute<{ current_user_id: string | null }>(sql`
    select current_setting('app.current_user_id', true) as current_user_id
  `);
  if (rows[0]?.current_user_id !== user.id) {
    throw new UnsafeDatabaseExecution({ message: "Database transaction identity was not established" });
  }
};

const provisionUser = async (tx: KairoTx, user: AuthenticatedUser): Promise<void> => {
  await tx.insert(schema.users).values({ id: user.id }).onConflictDoNothing({ target: schema.users.id });
};

export const makeDatabaseService = (url: URL | string, boundary: DatabaseRoleBoundary): DatabaseService => {
  const client = postgres(String(url), { max: 4, prepare: false, connect_timeout: 5 });
  const database = drizzle(client, { schema });
  const run = <A>(operation: (tx: KairoTx) => Promise<A>): Effect.Effect<A, DatabaseUnavailable | UnsafeDatabaseExecution> =>
    Effect.tryPromise({
      try: () => database.transaction(async (tx) => operation(tx as KairoTx)),
      catch: (cause) => cause instanceof UnsafeDatabaseExecution ? cause : new DatabaseUnavailable({ message: "Database request failed", requestId: requestId(), retryable: isTransientDatabaseCause(cause) }),
    });

  return {
    healthcheck: () => run(async (tx) => { await verifyRuntime(tx, boundary); return "ready" as const; }),
    withTransaction: (user, operation) => retryTransient(run(async (tx) => {
      await verifyRuntime(tx, boundary);
      await setIdentity(tx, user);
      await provisionUser(tx, user);
      return operation(tx);
    })),
    close: () => Effect.promise(() => client.end({ timeout: 5 }).then(() => undefined)),
  };
};

const isTransientDatabaseCause = (cause: unknown): boolean => {
  if (!cause || typeof cause !== "object") return false;
  const code = (cause as { readonly code?: unknown }).code;
  return typeof code === "string" && ["40001", "40P01", "55P03", "57014", "08000", "08003", "08006", "080C1"].includes(code);
};

export const retryTransient = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
  effect.pipe(Effect.retry({ while: (error) => error instanceof DatabaseUnavailable && error.retryable, schedule: Schedule.recurs(2) }));

export const databaseLayer = (service: DatabaseService): Layer.Layer<Database> => Layer.succeed(Database, service);

export const liveDatabaseLayer = Layer.effect(Database, Effect.gen(function* () {
  const config = yield* ServerConfig;
  if (Option.isNone(config.databaseUrl) || Option.isNone(config.databaseRuntimeRole) || Option.isNone(config.databaseMigrationRole)) {
    return yield* new UnsafeDatabaseExecution({ message: "Live database URL and distinct role names are required" });
  }
  return makeDatabaseService(Redacted.value(config.databaseUrl.value), {
    runtimeRole: config.databaseRuntimeRole.value,
    migrationRole: config.databaseMigrationRole.value,
  });
}));
