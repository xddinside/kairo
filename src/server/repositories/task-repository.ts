import { and, eq, isNull } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import type { AuthenticatedUser } from "../auth/user";
import { Database, type KairoTx, type DatabaseUnavailable, type UnsafeDatabaseExecution } from "../database/service";
import { tasks } from "../database/schema";
import { CreateTaskArgs, type Task } from "../domain/schema";

export class RepositoryDecodeError extends Schema.TaggedError<RepositoryDecodeError>()("Kairo.RepositoryDecodeError", { message: Schema.String }) {}

const rowSchema = Schema.Struct({ id: Schema.String, ownerId: Schema.String, title: Schema.String, details: Schema.NullOr(Schema.String), courseId: Schema.NullOr(Schema.String), assessmentId: Schema.NullOr(Schema.String), dueDate: Schema.NullOr(Schema.String), dueTime: Schema.NullOr(Schema.String), status: Schema.Literals(["open", "completed", "cancelled"] as const), version: Schema.Int, createdAt: Schema.Date, updatedAt: Schema.Date, deletedAt: Schema.NullOr(Schema.Date) });

const decode = (row: unknown): Task => {
  const result = Schema.decodeUnknownSync(rowSchema)(row);
  return result as Task;
};

export interface TaskRepository {
  readonly find: (tx: KairoTx, user: AuthenticatedUser, id: string) => Promise<Task | undefined>;
  readonly insert: (tx: KairoTx, user: AuthenticatedUser, input: Schema.Schema.Type<typeof CreateTaskArgs>) => Promise<Task>;
  readonly update: (tx: KairoTx, user: AuthenticatedUser, id: string, expectedVersion: number, patch: Partial<Task>) => Promise<Task | undefined>;
}

export class Tasks extends Context.Service<Tasks, TaskRepository>()("kairo/server/TaskRepository") {}

const implementation: TaskRepository = {
  find: async (tx, user, id) => {
    const rows = await tx.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.ownerId, user.id), isNull(tasks.deletedAt))).limit(1);
    return rows[0] ? decode({ ...rows[0], ownerId: rows[0].ownerId, courseId: rows[0].courseId, assessmentId: rows[0].assessmentId, dueDate: rows[0].dueDate, dueTime: rows[0].dueTime, deletedAt: rows[0].deletedAt }) : undefined;
  },
  insert: async (tx, user, input) => {
    const rows = await tx.insert(tasks).values({ ownerId: user.id, title: input.title, details: input.details ?? null, courseId: input.courseId ?? null, assessmentId: input.assessmentId ?? null, dueDate: input.dueDate ?? null, dueTime: input.dueTime ?? null }).returning();
    const row = rows[0];
    if (!row) throw new RepositoryDecodeError({ message: "Insert returned no task" });
    return decode({ ...row, ownerId: row.ownerId, courseId: row.courseId, assessmentId: row.assessmentId, dueDate: row.dueDate, dueTime: row.dueTime, deletedAt: row.deletedAt });
  },
  update: async (tx, user, id, expectedVersion, patch) => {
    const rows = await tx.update(tasks).set({ ...patch, version: expectedVersion + 1, updatedAt: new Date() }).where(and(eq(tasks.id, id), eq(tasks.ownerId, user.id), eq(tasks.version, expectedVersion), isNull(tasks.deletedAt))).returning();
    const row = rows[0];
    return row ? decode({ ...row, ownerId: row.ownerId, courseId: row.courseId, assessmentId: row.assessmentId, dueDate: row.dueDate, dueTime: row.dueTime, deletedAt: row.deletedAt }) : undefined;
  },
};

export const taskRepositoryLayer = Layer.succeed(Tasks, implementation);

type TaskServiceShape = {
  readonly get: (user: AuthenticatedUser, id: string) => Effect.Effect<Task | undefined, DatabaseUnavailable | UnsafeDatabaseExecution>;
  readonly create: (user: AuthenticatedUser, input: unknown) => Effect.Effect<Task, RepositoryDecodeError | DatabaseUnavailable | UnsafeDatabaseExecution>;
  readonly update: (user: AuthenticatedUser, id: string, expectedVersion: number, patch: Partial<Task>) => Effect.Effect<Task | undefined, DatabaseUnavailable | UnsafeDatabaseExecution>;
};
export class TaskService extends Context.Service<TaskService, TaskServiceShape>()("kairo/server/TaskService") {}

export const taskServiceLayer = Layer.effect(TaskService, Effect.gen(function* () {
  const database = yield* Database;
  const repository = yield* Tasks;
  return {
    get: (user, id) => database.withTransaction(user, (tx) => repository.find(tx, user, id)),
    create: (user, input) => Effect.gen(function* () { const decoded = yield* Schema.decodeUnknownEffect(CreateTaskArgs)(input).pipe(Effect.mapError((error) => new RepositoryDecodeError({ message: String(error) }))); return yield* database.withTransaction(user, (tx) => repository.insert(tx, user, decoded)); }),
    update: (user, id, expectedVersion, patch) => database.withTransaction(user, (tx) => repository.update(tx, user, id, expectedVersion, patch)),
  };
}));
