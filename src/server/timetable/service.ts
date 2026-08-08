import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import type { AuthenticatedUser } from "../auth/user";
import { Database, type DatabaseService, type KairoTx } from "../database/service";
import {
  courses,
  domainCommands,
  timetableEntries,
  timetableEntryExceptions,
  undoTokens,
  users,
} from "../database/schema";
import {
  CreateTimetableEntry,
  DeleteTimetableEntry,
  expandOccurrences,
  occursOn,
  SkipTimetableOccurrence,
  type TimetableCommandResult,
  type TimetableEntry,
  type TimetableOverlapWarning,
  UndoTimetableCommand,
  UpdateTimetableEntry,
  validateTimetableEntry,
} from "./domain";

/** Owner-scoped filters for a Timetable collection. */
export interface TimetableListInput {
  readonly from: string;
  readonly to: string;
  readonly q: string;
  readonly courseId: string | null;
  readonly pageSize: 10 | 25 | 50 | 100;
}

/** Timetable collection returned to stable routes and Canvas. */
export interface TimetableList {
  readonly items: ReadonlyArray<TimetableEntry>;
  readonly timeZone: string;
}

/** Application service for Timetable reads and commands. */
export interface TimetableServiceShape {
  readonly list: (user: AuthenticatedUser, input: TimetableListInput) => Effect.Effect<TimetableList, unknown>;
  readonly get: (user: AuthenticatedUser, entryId: string, from: string, to: string) => Effect.Effect<TimetableEntry | undefined, unknown>;
  readonly create: (user: AuthenticatedUser, input: unknown) => Effect.Effect<TimetableCommandResult, unknown>;
  readonly update: (user: AuthenticatedUser, input: unknown) => Effect.Effect<TimetableCommandResult, unknown>;
  readonly skipOccurrence: (user: AuthenticatedUser, input: unknown) => Effect.Effect<TimetableCommandResult, unknown>;
  readonly delete: (user: AuthenticatedUser, input: unknown) => Effect.Effect<TimetableCommandResult, unknown>;
  readonly undo: (user: AuthenticatedUser, input: unknown) => Effect.Effect<TimetableCommandResult, unknown>;
}

/** Timetable application service tag. */
export class TimetableService extends Context.Service<TimetableService, TimetableServiceShape>()("kairo/server/TimetableService") {}

type EntryRow = typeof timetableEntries.$inferSelect;
type CommandKind = "timetable.create" | "timetable.update" | "timetable.skip" | "timetable.delete" | "timetable.undo";

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const serializable = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const readTimeZone = async (tx: KairoTx, user: AuthenticatedUser): Promise<string> => {
  const rows = await tx.select({ timeZone: users.timeZone }).from(users).where(eq(users.id, user.id)).limit(1);
  return rows[0]?.timeZone ?? "UTC";
};

const readExceptions = async (tx: KairoTx, user: AuthenticatedUser, entryIds: ReadonlyArray<string>): Promise<Map<string, Array<string>>> => {
  const values = new Map<string, Array<string>>();
  if (entryIds.length === 0) return values;
  const rows = await tx
    .select({ entryId: timetableEntryExceptions.entryId, occurrenceDate: timetableEntryExceptions.occurrenceDate })
    .from(timetableEntryExceptions)
    .where(and(eq(timetableEntryExceptions.ownerId, user.id), inArray(timetableEntryExceptions.entryId, entryIds)));
  for (const row of rows) values.set(row.entryId, [...(values.get(row.entryId) ?? []), row.occurrenceDate]);
  return values;
};

const projectEntry = (
  row: EntryRow,
  courseTitle: string | null,
  exceptions: ReadonlyArray<string>,
  from: string,
  to: string,
  timeZone: string,
): TimetableEntry => {
  const base = {
    id: row.id,
    title: row.title,
    details: row.details,
    courseId: row.courseId,
    courseTitle,
    kind: row.kind,
    startDate: row.startDate,
    endDate: row.endDate,
    daysOfWeek: row.daysOfWeek,
    startTime: row.startTime.slice(0, 5),
    endTime: row.endTime.slice(0, 5),
    exceptions,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  return { ...base, occurrences: expandOccurrences(base, from, to, timeZone) };
};

const readProjectedEntries = async (
  tx: KairoTx,
  user: AuthenticatedUser,
  from: string,
  to: string,
): Promise<ReadonlyArray<TimetableEntry>> => {
  const rows = await tx
    .select({ entry: timetableEntries, courseTitle: courses.title })
    .from(timetableEntries)
    .leftJoin(courses, and(eq(courses.id, timetableEntries.courseId), eq(courses.ownerId, user.id), isNull(courses.deletedAt)))
    .where(and(eq(timetableEntries.ownerId, user.id), isNull(timetableEntries.deletedAt)));
  const exceptions = await readExceptions(tx, user, rows.map(({ entry }) => entry.id));
  const timeZone = await readTimeZone(tx, user);
  return rows.map(({ entry, courseTitle }) => projectEntry(entry, courseTitle, exceptions.get(entry.id) ?? [], from, to, timeZone));
};

const readProjectedEntry = async (
  tx: KairoTx,
  user: AuthenticatedUser,
  entryId: string,
  from: string,
  to: string,
): Promise<TimetableEntry | undefined> => {
  const entries = await readProjectedEntries(tx, user, from, to);
  return entries.find((entry) => entry.id === entryId);
};

const overlapWarnings = (entry: TimetableEntry, entries: ReadonlyArray<TimetableEntry>): ReadonlyArray<TimetableOverlapWarning> => {
  const warnings: Array<TimetableOverlapWarning> = [];
  for (const occurrence of entry.occurrences) {
    for (const candidate of entries) {
      if (candidate.id === entry.id) continue;
      for (const other of candidate.occurrences) {
        if (occurrence.date === other.date && occurrence.startTime < other.endTime && occurrence.endTime > other.startTime) {
          warnings.push({ entryId: candidate.id, title: candidate.title, date: other.date, startTime: other.startTime, endTime: other.endTime });
        }
      }
    }
  }
  return warnings;
};

const priorResult = (value: unknown): TimetableCommandResult | undefined => {
  if (!value || typeof value !== "object" || !("_tag" in value)) return undefined;
  const tag = Reflect.get(value, "_tag");
  if (tag === "applied" || tag === "already_applied") {
    const result = value as { readonly value?: unknown; readonly undoToken?: unknown; readonly overlapWarnings?: unknown };
    return {
      _tag: "already_applied",
      value: result.value && typeof result.value === "object" ? result.value as TimetableEntry : null,
      ...(typeof result.undoToken === "string" ? { undoToken: result.undoToken } : {}),
      overlapWarnings: Array.isArray(result.overlapWarnings) ? result.overlapWarnings as ReadonlyArray<TimetableOverlapWarning> : [],
    };
  }
  if (tag === "not_found") return { _tag: "not_found" };
  return undefined;
};

const findPrior = async (tx: KairoTx, user: AuthenticatedUser, idempotencyKey: string): Promise<TimetableCommandResult | undefined> => {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${user.id}:${idempotencyKey}`}, 0))`);
  const rows = await tx.select({ result: domainCommands.result }).from(domainCommands).where(and(eq(domainCommands.ownerId, user.id), eq(domainCommands.idempotencyKey, idempotencyKey))).limit(1);
  return rows[0] ? priorResult(rows[0].result) : undefined;
};

const saveResult = async (
  tx: KairoTx,
  user: AuthenticatedUser,
  idempotencyKey: string,
  kind: CommandKind,
  args: unknown,
  result: TimetableCommandResult,
  targetId?: string,
  expectedVersion?: number,
): Promise<void> => {
  await tx.insert(domainCommands).values({
    ownerId: user.id,
    idempotencyKey,
    commandVersion: 1,
    kind,
    targetType: "timetable_entry",
    targetId: targetId ?? null,
    expectedVersion: expectedVersion ?? null,
    state: result._tag === "applied" ? "applied" : result._tag === "already_applied" ? "already_applied" : result._tag === "conflict" ? "conflict" : result._tag === "not_found" ? "not_found" : "invalid",
    args: serializable(args),
    result: serializable(result),
    errorCode: result._tag === "conflict" ? "stale_version" : result._tag === "invalid" ? "invalid" : null,
    completedAt: new Date(),
  });
};

const saveUndo = async (
  tx: KairoTx,
  user: AuthenticatedUser,
  idempotencyKey: string,
  token: string,
  inverse: unknown,
  expectedVersion: number,
): Promise<void> => {
  await tx.insert(undoTokens).values({
    ownerId: user.id,
    commandId: sql`(select id from domain_commands where owner_id = ${user.id} and idempotency_key = ${idempotencyKey})`,
    tokenHash: hash(token),
    inverse: serializable(inverse),
    expectedVersion,
    expiresAt: new Date(Date.now() + 30_000),
  });
};

const verifyCourse = async (tx: KairoTx, user: AuthenticatedUser, courseId: string | null | undefined): Promise<boolean> => {
  if (!courseId) return true;
  const rows = await tx.select({ id: courses.id }).from(courses).where(and(eq(courses.id, courseId), eq(courses.ownerId, user.id), isNull(courses.deletedAt))).limit(1);
  return Boolean(rows[0]);
};

const makeService = (database: DatabaseService): TimetableServiceShape => ({
  list: Effect.fn("Timetable.list")((user, input) => database.withTransaction(user, async (tx) => {
    const items = await readProjectedEntries(tx, user, input.from, input.to);
    const normalizedQuery = input.q.trim().normalize("NFKC").toLocaleLowerCase();
    const filtered = items
      .filter((entry) => entry.occurrences.length > 0)
      .filter((entry) => !input.courseId || entry.courseId === input.courseId)
      .filter((entry) => !normalizedQuery || entry.title.normalize("NFKC").toLocaleLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        const leftOccurrence = left.occurrences[0];
        const rightOccurrence = right.occurrences[0];
        if (!leftOccurrence || !rightOccurrence) return left.id.localeCompare(right.id);
        return leftOccurrence.date.localeCompare(rightOccurrence.date) || leftOccurrence.startTime.localeCompare(rightOccurrence.startTime) || left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
      })
      .slice(0, input.pageSize);
    return { items: filtered, timeZone: await readTimeZone(tx, user) };
  })),
  get: Effect.fn("Timetable.get")((user, entryId, from, to) => database.withTransaction(user, (tx) => readProjectedEntry(tx, user, entryId, from, to))),
  create: Effect.fn("Timetable.create")((user, input) => Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(CreateTimetableEntry)(input);
    return yield* database.withTransaction(user, async (tx) => {
      const prior = await findPrior(tx, user, args.idempotencyKey);
      if (prior) return prior;
      const timeZone = await readTimeZone(tx, user);
      const fields = validateTimetableEntry(args, timeZone);
      if (fields.length > 0) {
        const result = { _tag: "invalid", fields } as const;
        await saveResult(tx, user, args.idempotencyKey, "timetable.create", args, result);
        return result;
      }
      if (!await verifyCourse(tx, user, args.courseId)) {
        const result = { _tag: "not_found" } as const;
        await saveResult(tx, user, args.idempotencyKey, "timetable.create", args, result);
        return result;
      }
      const rows = await tx.insert(timetableEntries).values({ ownerId: user.id, title: args.title.trim(), details: args.details ?? null, courseId: args.courseId ?? null, kind: args.kind, startDate: args.startDate, endDate: args.endDate, daysOfWeek: [...args.daysOfWeek], startTime: args.startTime, endTime: args.endTime }).returning();
      const row = rows[0];
      if (!row) return { _tag: "invalid", fields: [{ field: "form", message: "Entry could not be created" }] } as const;
      const value = await readProjectedEntry(tx, user, row.id, row.startDate, row.endDate);
      if (!value) return { _tag: "not_found" } as const;
      const warnings = overlapWarnings(value, await readProjectedEntries(tx, user, row.startDate, row.endDate));
      const token = randomBytes(32).toString("base64url");
      const result = { _tag: "applied", value, undoToken: token, overlapWarnings: warnings } as const;
      await saveResult(tx, user, args.idempotencyKey, "timetable.create", args, result, row.id, 1);
      await saveUndo(tx, user, args.idempotencyKey, token, { kind: "timetable.create", entryId: row.id }, row.version);
      return result;
    });
  })),
  update: Effect.fn("Timetable.update")((user, input) => Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(UpdateTimetableEntry)(input);
    return yield* database.withTransaction(user, async (tx) => {
      const prior = await findPrior(tx, user, args.idempotencyKey);
      if (prior) return prior;
      const currentRows = await tx.select().from(timetableEntries).where(and(eq(timetableEntries.id, args.entryId), eq(timetableEntries.ownerId, user.id), isNull(timetableEntries.deletedAt))).limit(1);
      const current = currentRows[0];
      if (!current) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "timetable.update", args, result, args.entryId, args.expectedVersion); return result; }
      if (current.version !== args.expectedVersion) { const result = { _tag: "conflict", current: await readProjectedEntry(tx, user, args.entryId, current.startDate, current.endDate) } as const; await saveResult(tx, user, args.idempotencyKey, "timetable.update", args, result, args.entryId, args.expectedVersion); return result; }
      const timeZone = await readTimeZone(tx, user);
      const fields = validateTimetableEntry(args, timeZone);
      if (fields.length > 0) { const result = { _tag: "invalid", fields } as const; await saveResult(tx, user, args.idempotencyKey, "timetable.update", args, result, args.entryId, args.expectedVersion); return result; }
      if (!await verifyCourse(tx, user, args.courseId)) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "timetable.update", args, result, args.entryId, args.expectedVersion); return result; }
      const changed = await tx.update(timetableEntries).set({ title: args.title.trim(), details: args.details, courseId: args.courseId, kind: args.kind, startDate: args.startDate, endDate: args.endDate, daysOfWeek: [...args.daysOfWeek], startTime: args.startTime, endTime: args.endTime, version: current.version + 1, updatedAt: new Date() }).where(and(eq(timetableEntries.id, args.entryId), eq(timetableEntries.ownerId, user.id), eq(timetableEntries.version, current.version))).returning();
      const row = changed[0];
      if (!row) return { _tag: "conflict" } as const;
      if (args.kind === "one_off") await tx.delete(timetableEntryExceptions).where(and(eq(timetableEntryExceptions.entryId, row.id), eq(timetableEntryExceptions.ownerId, user.id)));
      const value = await readProjectedEntry(tx, user, row.id, row.startDate, row.endDate);
      if (!value) return { _tag: "not_found" } as const;
      const token = randomBytes(32).toString("base64url");
      const result = { _tag: "applied", value, undoToken: token, overlapWarnings: overlapWarnings(value, await readProjectedEntries(tx, user, row.startDate, row.endDate)) } as const;
      await saveResult(tx, user, args.idempotencyKey, "timetable.update", args, result, row.id, args.expectedVersion);
      await saveUndo(tx, user, args.idempotencyKey, token, { kind: "timetable.restore", entry: current }, row.version);
      return result;
    });
  })),
  skipOccurrence: Effect.fn("Timetable.skipOccurrence")((user, input) => Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(SkipTimetableOccurrence)(input);
    return yield* database.withTransaction(user, async (tx) => {
      const prior = await findPrior(tx, user, args.idempotencyKey);
      if (prior) return prior;
      const current = await readProjectedEntry(tx, user, args.entryId, args.occurrenceDate, args.occurrenceDate);
      if (!current) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "timetable.skip", args, result, args.entryId, args.expectedVersion); return result; }
      if (current.version !== args.expectedVersion) { const result = { _tag: "conflict", current } as const; await saveResult(tx, user, args.idempotencyKey, "timetable.skip", args, result, args.entryId, args.expectedVersion); return result; }
      if (current.kind !== "weekly" || !occursOn(current, args.occurrenceDate)) { const result = { _tag: "invalid", fields: [{ field: "occurrenceDate", message: "Choose an occurrence produced by this weekly entry" }] } as const; await saveResult(tx, user, args.idempotencyKey, "timetable.skip", args, result, args.entryId, args.expectedVersion); return result; }
      await tx.insert(timetableEntryExceptions).values({ entryId: current.id, ownerId: user.id, occurrenceDate: args.occurrenceDate });
      const changed = await tx.update(timetableEntries).set({ version: current.version + 1, updatedAt: new Date() }).where(and(eq(timetableEntries.id, current.id), eq(timetableEntries.ownerId, user.id), eq(timetableEntries.version, current.version))).returning();
      const row = changed[0];
      if (!row) return { _tag: "conflict" } as const;
      const value = await readProjectedEntry(tx, user, current.id, current.startDate, current.endDate);
      if (!value) return { _tag: "not_found" } as const;
      const token = randomBytes(32).toString("base64url");
      const result = { _tag: "applied", value, undoToken: token, overlapWarnings: [] } as const;
      await saveResult(tx, user, args.idempotencyKey, "timetable.skip", args, result, row.id, args.expectedVersion);
      await saveUndo(tx, user, args.idempotencyKey, token, { kind: "timetable.unskip", entryId: row.id, occurrenceDate: args.occurrenceDate }, row.version);
      return result;
    });
  })),
  delete: Effect.fn("Timetable.delete")((user, input) => Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(DeleteTimetableEntry)(input);
    return yield* database.withTransaction(user, async (tx) => {
      const prior = await findPrior(tx, user, args.idempotencyKey);
      if (prior) return prior;
      const currentRows = await tx.select().from(timetableEntries).where(and(eq(timetableEntries.id, args.entryId), eq(timetableEntries.ownerId, user.id), isNull(timetableEntries.deletedAt))).limit(1);
      const current = currentRows[0];
      if (!current) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "timetable.delete", args, result, args.entryId, args.expectedVersion); return result; }
      if (current.version !== args.expectedVersion) { const result = { _tag: "conflict", current: await readProjectedEntry(tx, user, args.entryId, current.startDate, current.endDate) } as const; await saveResult(tx, user, args.idempotencyKey, "timetable.delete", args, result, args.entryId, args.expectedVersion); return result; }
      const changed = await tx.update(timetableEntries).set({ deletedAt: new Date(), purgeAfter: new Date(Date.now() + 30 * 86_400_000), version: current.version + 1, updatedAt: new Date() }).where(and(eq(timetableEntries.id, current.id), eq(timetableEntries.ownerId, user.id), eq(timetableEntries.version, current.version))).returning();
      const row = changed[0];
      if (!row) return { _tag: "conflict" } as const;
      const token = randomBytes(32).toString("base64url");
      const result = { _tag: "applied", value: null, undoToken: token, overlapWarnings: [] } as const;
      await saveResult(tx, user, args.idempotencyKey, "timetable.delete", args, result, row.id, args.expectedVersion);
      await saveUndo(tx, user, args.idempotencyKey, token, { kind: "timetable.restore", entry: current }, row.version);
      return result;
    });
  })),
  undo: Effect.fn("Timetable.undo")((user, input) => Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(UndoTimetableCommand)(input);
    return yield* database.withTransaction(user, async (tx) => {
      const prior = await findPrior(tx, user, args.idempotencyKey);
      if (prior) return prior;
      const rows = await tx.select().from(undoTokens).where(and(eq(undoTokens.ownerId, user.id), eq(undoTokens.tokenHash, hash(args.token)), isNull(undoTokens.consumedAt), sql`${undoTokens.expiresAt} > now()`)).limit(1).for("update");
      const undo = rows[0];
      if (!undo || !undo.inverse || typeof undo.inverse !== "object") { const result = { _tag: "conflict" } as const; await saveResult(tx, user, args.idempotencyKey, "timetable.undo", { token: "[redacted]" }, result); return result; }
      const kind = Reflect.get(undo.inverse, "kind");
      const entryId = Reflect.get(undo.inverse, "entryId");
      const entry = Reflect.get(undo.inverse, "entry");
      const occurrenceDate = Reflect.get(undo.inverse, "occurrenceDate");
      if (kind === "timetable.create" && typeof entryId === "string") {
        const removed = await tx.delete(timetableEntries).where(and(eq(timetableEntries.id, entryId), eq(timetableEntries.ownerId, user.id), eq(timetableEntries.version, undo.expectedVersion))).returning();
        if (!removed[0]) return { _tag: "conflict" } as const;
      } else if (kind === "timetable.unskip" && typeof entryId === "string" && typeof occurrenceDate === "string") {
        const current = await tx.select().from(timetableEntries).where(and(eq(timetableEntries.id, entryId), eq(timetableEntries.ownerId, user.id), eq(timetableEntries.version, undo.expectedVersion))).limit(1);
        if (!current[0]) return { _tag: "conflict" } as const;
        await tx.delete(timetableEntryExceptions).where(and(eq(timetableEntryExceptions.entryId, entryId), eq(timetableEntryExceptions.ownerId, user.id), eq(timetableEntryExceptions.occurrenceDate, occurrenceDate)));
        await tx.update(timetableEntries).set({ version: undo.expectedVersion + 1, updatedAt: new Date() }).where(and(eq(timetableEntries.id, entryId), eq(timetableEntries.ownerId, user.id), eq(timetableEntries.version, undo.expectedVersion)));
      } else if (kind === "timetable.restore" && entry && typeof entry === "object") {
        const restoredId = Reflect.get(entry, "id");
        if (typeof restoredId !== "string") return { _tag: "conflict" } as const;
        const current = await tx.select().from(timetableEntries).where(and(eq(timetableEntries.id, restoredId), eq(timetableEntries.ownerId, user.id), eq(timetableEntries.version, undo.expectedVersion))).limit(1);
        if (!current[0]) return { _tag: "conflict" } as const;
        await tx.update(timetableEntries).set({
          title: String(Reflect.get(entry, "title")),
          details: typeof Reflect.get(entry, "details") === "string" ? String(Reflect.get(entry, "details")) : null,
          courseId: typeof Reflect.get(entry, "courseId") === "string" ? String(Reflect.get(entry, "courseId")) : null,
          kind: Reflect.get(entry, "kind") === "weekly" ? "weekly" : "one_off",
          startDate: String(Reflect.get(entry, "startDate")),
          endDate: String(Reflect.get(entry, "endDate")),
          daysOfWeek: Array.isArray(Reflect.get(entry, "daysOfWeek")) ? Reflect.get(entry, "daysOfWeek") : [],
          startTime: String(Reflect.get(entry, "startTime")),
          endTime: String(Reflect.get(entry, "endTime")),
          deletedAt: null,
          purgeAfter: null,
          version: undo.expectedVersion + 1,
          updatedAt: new Date(),
        }).where(and(eq(timetableEntries.id, restoredId), eq(timetableEntries.ownerId, user.id), eq(timetableEntries.version, undo.expectedVersion)));
      } else return { _tag: "conflict" } as const;
      await tx.update(undoTokens).set({ consumedAt: new Date() }).where(and(eq(undoTokens.id, undo.id), isNull(undoTokens.consumedAt)));
      const result = { _tag: "applied", value: null, overlapWarnings: [] } as const;
      await saveResult(tx, user, args.idempotencyKey, "timetable.undo", { token: "[redacted]" }, result);
      return result;
    });
  })),
});

/** Build the Timetable service from an existing Database service. */
export const timetableServiceLayer = Layer.effect(TimetableService, Effect.gen(function* () {
  return TimetableService.of(makeService(yield* Database));
}));
