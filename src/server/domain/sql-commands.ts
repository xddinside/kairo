import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";

import type { AuthenticatedUser } from "../auth/user";
import { Database, type DatabaseService } from "../database/service";
import { assessments, domainCommands, tasks, undoTokens } from "../database/schema";
import { CommandEnvelope, CreateTaskArgs, UndoArgs, type CommandResult, type Task } from "./schema";
import { CommandInvalid, DomainCommands, type DomainCommandService } from "./commands";
import { Schema } from "effect";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const resultValue = (row: any, kind: "task" | "assessment" = "task"): Task => ({ kind: kind === "assessment" ? "assessment" : undefined, id: row.id, ownerId: row.ownerId, title: row.title, details: row.details, courseId: row.courseId, assessmentId: row.assessmentId ?? null, dueDate: row.dueDate, dueTime: row.dueTime, status: row.status, version: row.version, createdAt: row.createdAt, updatedAt: row.updatedAt, deletedAt: row.deletedAt } as Task);

const persist = async (tx: any, user: AuthenticatedUser, envelope: Schema.Schema.Type<typeof CommandEnvelope>, result: CommandResult, targetType?: string, targetId?: string, expectedVersion?: number) => {
  await tx.insert(domainCommands).values({ ownerId: user.id, canvasId: envelope.canvasId ?? null, sourceActivityId: envelope.sourceActivityId ?? null, idempotencyKey: envelope.idempotencyKey, commandVersion: envelope.version, kind: envelope.kind, targetType: targetType ?? null, targetId: targetId ?? null, expectedVersion: expectedVersion ?? null, state: result._tag === "applied" ? "applied" : result._tag === "already_applied" ? "already_applied" : result._tag === "conflict" ? "conflict" : result._tag === "not_found" ? "not_found" : result._tag === "invalid" ? "invalid" : "unavailable", args: json(envelope.args), result: json(result), errorCode: result._tag === "invalid" ? "invalid" : result._tag === "conflict" ? result.reason : null }).onConflictDoNothing();
  return result;
};

const serviceFor = (database: DatabaseService): DomainCommandService => ({
  execute: (user, input) => Effect.gen(function* () {
    const envelope = yield* Schema.decodeUnknownEffect(CommandEnvelope)(input).pipe(Effect.mapError((error) => new CommandInvalid({ fields: [{ field: "command", message: String(error) }] })));
    return yield* database.withTransaction(user, async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${user.id}:${envelope.idempotencyKey}`}, 0))`);
      const prior = await tx.select().from(domainCommands).where(and(eq(domainCommands.ownerId, user.id), eq(domainCommands.idempotencyKey, envelope.idempotencyKey))).limit(1);
      if (prior[0]) {
        const priorResult = prior[0].result as CommandResult;
        return ("value" in priorResult ? { ...priorResult, _tag: "already_applied" } : priorResult) as CommandResult;
      }
      const save = (result: CommandResult, type?: string, id?: string, expected?: number) => persist(tx, user, envelope, result, type, id, expected);
      if (envelope.kind === "undo") {
        const undoArgs = Schema.decodeUnknownSync(UndoArgs)(envelope.args);
        const rows = await tx.select().from(undoTokens).where(and(eq(undoTokens.ownerId, user.id), eq(undoTokens.tokenHash, hash(undoArgs.token)), isNull(undoTokens.consumedAt), gt(undoTokens.expiresAt, new Date()))).limit(1).for("update");
        const undo = rows[0];
        if (!undo) return save({ _tag: "conflict", reason: "unsafe_undo" });
        const inverse = undo.inverse as { readonly operation?: string; readonly targetId?: string; readonly targetType?: "task" | "assessment"; readonly previous?: Record<string, unknown> };
        const table = inverse.targetType === "assessment" ? assessments : tasks;
        const targetId = inverse.targetId;
        if (!targetId) return save({ _tag: "conflict", reason: "unsafe_undo" });
        if (inverse.operation === "delete") {
          const deleted = await tx.delete(tasks).where(and(eq(tasks.id, targetId), eq(tasks.ownerId, user.id), eq(tasks.version, undo.expectedVersion))).returning();
          if (!deleted[0]) return save({ _tag: "conflict", reason: "unsafe_undo" });
        } else {
          const current = await tx.select().from(table).where(and(eq(table.id, targetId), eq(table.ownerId, user.id), eq(table.version, undo.expectedVersion))).limit(1);
          if (!current[0] || !inverse.previous) return save({ _tag: "conflict", reason: "unsafe_undo" });
          await tx.update(table).set({ ...inverse.previous, version: undo.expectedVersion + 1, updatedAt: new Date() }).where(and(eq(table.id, targetId), eq(table.ownerId, user.id), eq(table.version, undo.expectedVersion)));
        }
        const claimed = await tx.update(undoTokens).set({ consumedAt: new Date() }).where(and(eq(undoTokens.id, undo.id), eq(undoTokens.ownerId, user.id), isNull(undoTokens.consumedAt), gt(undoTokens.expiresAt, new Date()), eq(undoTokens.expectedVersion, undo.expectedVersion))).returning({ id: undoTokens.id });
        if (!claimed[0]) throw new Error("Undo token claim lost after row lock");
        return save({ _tag: "applied", value: null });
      }
      if (envelope.kind === "task.create") {
        const args = Schema.decodeUnknownSync(CreateTaskArgs)(envelope.args);
        if (args.dueTime && !args.dueDate) return save({ _tag: "invalid", fields: [{ field: "dueTime", message: "A due time requires a due date" }] });
        const rows = await tx.insert(tasks).values({ ownerId: user.id, title: args.title.trim(), details: args.details ?? null, courseId: args.courseId ?? null, assessmentId: args.assessmentId ?? null, dueDate: args.dueDate ?? null, dueTime: args.dueTime ?? null }).returning();
        const row = rows[0];
        if (!row) return save({ _tag: "unavailable", retryable: true, requestId: randomUUID() });
        const value = resultValue(row);
        const token = randomBytes(32).toString("base64url");
        const result: CommandResult = { _tag: "applied", value, undoToken: token };
        await save(result, "task", row.id, 1);
        await tx.insert(undoTokens).values({ ownerId: user.id, commandId: sql`(select id from domain_commands where owner_id = ${user.id} and idempotency_key = ${envelope.idempotencyKey})`, tokenHash: hash(token), inverse: json({ operation: "delete", targetId: row.id }), expectedVersion: row.version, expiresAt: new Date(Date.now() + 30_000) });
        return result;
      }
      const args = envelope.args as { readonly taskId?: string; readonly expectedVersion?: number; readonly patch?: Record<string, unknown>; readonly record?: { kind: "task" | "assessment"; id: string }; readonly status?: Task["status"] };
      const targetType = args.record?.kind ?? "task";
      const targetId = args.taskId ?? args.record?.id;
      if (!targetId) return save({ _tag: "invalid", fields: [{ field: "record", message: "Record id is required" }] });
      const table = targetType === "assessment" ? assessments : tasks;
      const found = await tx.select().from(table).where(and(eq(table.id, targetId), eq(table.ownerId, user.id), isNull(table.deletedAt))).limit(1);
      const row = found[0];
      if (!row) return save({ _tag: "not_found" }, targetType, targetId);
      if (row.version !== args.expectedVersion) return save({ _tag: "conflict", reason: "stale_version", current: resultValue(row, targetType) }, targetType, targetId, args.expectedVersion);
      if (envelope.kind === "academic.delete" && targetType === "assessment") {
        const dependents = await tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.ownerId, user.id), eq(tasks.assessmentId, targetId), isNull(tasks.deletedAt))).limit(1);
        if (dependents[0]) return save({ _tag: "conflict", reason: "has_dependents", current: resultValue(row, "assessment") }, targetType, targetId, args.expectedVersion);
      }
      const patch = envelope.kind === "task.update" ? args.patch ?? {} : envelope.kind === "academic.status" ? { status: args.status } : { deletedAt: new Date(), purgeAfter: new Date(Date.now() + 30 * 86400000) };
      const updated = await tx.update(table).set({ ...patch, version: row.version + 1, updatedAt: new Date() }).where(and(eq(table.id, targetId), eq(table.ownerId, user.id), eq(table.version, row.version))).returning();
      const changed = updated[0];
      if (!changed) return save({ _tag: "conflict", reason: "stale_version", current: resultValue(row, targetType) }, targetType, targetId, args.expectedVersion);
      const token = randomBytes(32).toString("base64url");
      const result: CommandResult = { _tag: "applied", value: resultValue(changed, targetType), undoToken: token };
      await save(result, targetType, targetId, args.expectedVersion);
      await tx.insert(undoTokens).values({ ownerId: user.id, commandId: sql`(select id from domain_commands where owner_id = ${user.id} and idempotency_key = ${envelope.idempotencyKey})`, tokenHash: hash(token), inverse: json({ operation: "restore", targetType, targetId, previous: row }), expectedVersion: changed.version, expiresAt: new Date(Date.now() + 30_000) });
      return result;
    });
  }),
});

export const productionDomainCommandsLayer = Layer.effect(DomainCommands, Effect.gen(function* () { return serviceFor(yield* Database); }));
