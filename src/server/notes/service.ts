import { createHash, createHmac, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, ilike, isNull, lt, or, sql } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import type { AuthenticatedUser } from "../auth/user";
import { Database, type DatabaseService, type KairoTx } from "../database/service";
import { courses, domainCommands, notes, undoTokens } from "../database/schema";
import {
  CreateNote,
  DeleteNote,
  normalizeMarkdown,
  type Note,
  type NoteCommandResult,
  type NoteCourseOption,
  type NoteListItem,
  type NoteSort,
  notePreview,
  UndoNoteCommand,
  UpdateNote,
  validateNote,
} from "./domain";

/** Owner-scoped filters for a Notes collection. */
export interface NoteListInput {
  readonly q: string;
  readonly courseId: string | "none" | null;
  readonly sort: NoteSort;
  readonly pageSize: 10 | 25 | 50 | 100;
  readonly cursor: string | null;
}

/** Notes collection returned to stable routes and Canvas. */
export interface NoteList {
  readonly items: ReadonlyArray<NoteListItem>;
  readonly nextCursor: string | null;
  readonly hasNext: boolean;
  readonly invalidCursor: boolean;
  readonly courses: ReadonlyArray<NoteCourseOption>;
}

/** Application service for Note reads and commands. */
export interface NoteServiceShape {
  readonly list: (user: AuthenticatedUser, input: NoteListInput) => Effect.Effect<NoteList, unknown>;
  readonly get: (user: AuthenticatedUser, noteId: string) => Effect.Effect<Note | undefined, unknown>;
  readonly courses: (user: AuthenticatedUser) => Effect.Effect<ReadonlyArray<NoteCourseOption>, unknown>;
  readonly create: (user: AuthenticatedUser, input: unknown) => Effect.Effect<NoteCommandResult, unknown>;
  readonly update: (user: AuthenticatedUser, input: unknown) => Effect.Effect<NoteCommandResult, unknown>;
  readonly delete: (user: AuthenticatedUser, input: unknown) => Effect.Effect<NoteCommandResult, unknown>;
  readonly undo: (user: AuthenticatedUser, input: unknown) => Effect.Effect<NoteCommandResult, unknown>;
}

/** Note application service tag. */
export class NoteService extends Context.Service<NoteService, NoteServiceShape>()("kairo/server/NoteService") {}

type NoteRow = typeof notes.$inferSelect;
type CommandKind = "note.create" | "note.update" | "note.delete" | "note.undo";
type Cursor = { readonly key: string; readonly id: string; readonly fingerprint: string; readonly expiresAt: number };

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const serializable = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null;
const isUuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const projectNote = (row: NoteRow, courseTitle: string | null): Note => ({
  id: row.id,
  title: row.title,
  bodyMarkdown: row.bodyMarkdown,
  courseId: row.courseId,
  courseTitle,
  version: row.version,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const readNote = async (tx: KairoTx, user: AuthenticatedUser, noteId: string): Promise<Note | undefined> => {
  if (!isUuid(noteId)) return undefined;
  const rows = await tx
    .select({ note: notes, courseTitle: courses.title })
    .from(notes)
    .leftJoin(courses, and(eq(courses.id, notes.courseId), eq(courses.ownerId, user.id), isNull(courses.deletedAt)))
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, user.id), isNull(notes.deletedAt)))
    .limit(1);
  const row = rows[0];
  return row ? projectNote(row.note, row.courseTitle) : undefined;
};

const readCourses = async (tx: KairoTx, user: AuthenticatedUser): Promise<ReadonlyArray<NoteCourseOption>> => tx
  .select({ id: courses.id, title: courses.title })
  .from(courses)
  .where(and(eq(courses.ownerId, user.id), isNull(courses.archivedAt), isNull(courses.deletedAt)))
  .orderBy(asc(courses.title), asc(courses.id));

const verifyCourse = async (tx: KairoTx, user: AuthenticatedUser, courseId: string | null | undefined): Promise<boolean> => {
  if (!courseId) return true;
  const rows = await tx.select({ id: courses.id }).from(courses).where(and(eq(courses.id, courseId), eq(courses.ownerId, user.id), isNull(courses.archivedAt), isNull(courses.deletedAt))).limit(1);
  return Boolean(rows[0]);
};

const cursorFingerprint = (input: NoteListInput): string => hash(JSON.stringify({ q: input.q, courseId: input.courseId, sort: input.sort, pageSize: input.pageSize }));
const cursorSignature = (user: AuthenticatedUser, payload: string): string => createHmac("sha256", user.sessionId).update(payload).digest("base64url");

const encodeCursor = (user: AuthenticatedUser, cursor: Cursor): string => {
  const payload = Buffer.from(JSON.stringify(cursor)).toString("base64url");
  return `${payload}.${cursorSignature(user, payload)}`;
};

const decodeCursor = (user: AuthenticatedUser, input: NoteListInput): Cursor | undefined => {
  if (!input.cursor) return undefined;
  const [payload, signature, extra] = input.cursor.split(".");
  if (!payload || !signature || extra || signature !== cursorSignature(user, payload)) return undefined;
  try {
    const value: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!isRecord(value) || typeof value.key !== "string" || typeof value.id !== "string" || typeof value.fingerprint !== "string" || typeof value.expiresAt !== "number") return undefined;
    if (value.fingerprint !== cursorFingerprint(input) || value.expiresAt <= Date.now()) return undefined;
    return { key: value.key, id: value.id, fingerprint: value.fingerprint, expiresAt: value.expiresAt };
  } catch {
    return undefined;
  }
};

const priorResult = (value: unknown): NoteCommandResult | undefined => {
  if (!isRecord(value) || typeof value._tag !== "string") return undefined;
  if (value._tag === "not_found") return { _tag: "not_found" };
  if (value._tag === "conflict") return { _tag: "conflict" };
  if (value._tag === "invalid" && Array.isArray(value.fields)) return { _tag: "invalid", fields: value.fields.flatMap((field) => isRecord(field) && typeof field.field === "string" && typeof field.message === "string" ? [{ field: field.field, message: field.message }] : []) };
  if (value._tag !== "applied" && value._tag !== "already_applied") return undefined;
  const noteValue = isRecord(value.value) && typeof value.value.id === "string" && typeof value.value.title === "string" && typeof value.value.bodyMarkdown === "string" && typeof value.value.version === "number" && typeof value.value.createdAt === "string" && typeof value.value.updatedAt === "string"
    ? {
      id: value.value.id,
      title: value.value.title,
      bodyMarkdown: value.value.bodyMarkdown,
      courseId: typeof value.value.courseId === "string" ? value.value.courseId : null,
      courseTitle: typeof value.value.courseTitle === "string" ? value.value.courseTitle : null,
      version: value.value.version,
      createdAt: value.value.createdAt,
      updatedAt: value.value.updatedAt,
    }
    : null;
  return { _tag: "already_applied", value: noteValue, ...(typeof value.undoToken === "string" ? { undoToken: value.undoToken } : {}) };
};

const findPrior = async (tx: KairoTx, user: AuthenticatedUser, idempotencyKey: string): Promise<NoteCommandResult | undefined> => {
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
  result: NoteCommandResult,
  targetId?: string,
  expectedVersion?: number,
): Promise<void> => {
  await tx.insert(domainCommands).values({
    ownerId: user.id,
    idempotencyKey,
    commandVersion: 1,
    kind,
    targetType: "note",
    targetId: targetId ?? null,
    expectedVersion: expectedVersion ?? null,
    state: result._tag === "applied" ? "applied" : result._tag === "already_applied" ? "already_applied" : result._tag,
    args: serializable(args),
    result: serializable(result),
    errorCode: result._tag === "conflict" ? "stale_version" : result._tag === "invalid" ? "invalid" : null,
    completedAt: new Date(),
  });
};

const saveUndo = async (tx: KairoTx, user: AuthenticatedUser, idempotencyKey: string, token: string, inverse: unknown, expectedVersion: number): Promise<void> => {
  await tx.insert(undoTokens).values({
    ownerId: user.id,
    commandId: sql`(select id from domain_commands where owner_id = ${user.id} and idempotency_key = ${idempotencyKey})`,
    tokenHash: hash(token),
    inverse: serializable(inverse),
    expectedVersion,
    expiresAt: new Date(Date.now() + 30_000),
  });
};

const invalid = (field: string, message: string): NoteCommandResult => ({ _tag: "invalid", fields: [{ field, message }] });

const makeService = (database: DatabaseService): NoteServiceShape => ({
  list: Effect.fn("Note.list")((user, input) => database.withTransaction(user, async (tx) => {
    const normalizedQuery = input.q.trim().normalize("NFKC").slice(0, 100);
    const decodedCursor = decodeCursor(user, input);
    const invalidCursor = Boolean(input.cursor && !decodedCursor);
    const filters = [eq(notes.ownerId, user.id), isNull(notes.deletedAt)];
    if (normalizedQuery) filters.push(or(ilike(notes.title, `%${normalizedQuery.replace(/[\\%_]/g, "\\$&")}%`), ilike(notes.bodyMarkdown, `%${normalizedQuery.replace(/[\\%_]/g, "\\$&")}%`))!);
    if (input.courseId === "none") filters.push(isNull(notes.courseId));
    else if (input.courseId) filters.push(eq(notes.courseId, input.courseId));
    if (decodedCursor) {
      if (input.sort === "title_asc") filters.push(or(gt(notes.title, decodedCursor.key), and(eq(notes.title, decodedCursor.key), gt(notes.id, decodedCursor.id)))!);
      else {
        const cursorDate = new Date(decodedCursor.key);
        const column = input.sort === "created_desc" ? notes.createdAt : notes.updatedAt;
        filters.push(or(lt(column, cursorDate), and(eq(column, cursorDate), lt(notes.id, decodedCursor.id)))!);
      }
    }
    const order = input.sort === "title_asc" ? [asc(notes.title), asc(notes.id)] : input.sort === "created_desc" ? [desc(notes.createdAt), desc(notes.id)] : [desc(notes.updatedAt), desc(notes.id)];
    const rows = await tx.select({ note: notes, courseTitle: courses.title }).from(notes)
      .leftJoin(courses, and(eq(courses.id, notes.courseId), eq(courses.ownerId, user.id), isNull(courses.deletedAt)))
      .where(and(...filters)).orderBy(...order).limit(input.pageSize + 1);
    const hasNext = rows.length > input.pageSize;
    const page = rows.slice(0, input.pageSize);
    const items = page.map(({ note, courseTitle }) => ({ ...projectNote(note, courseTitle), bodyMarkdown: undefined, preview: notePreview(note.bodyMarkdown) })).map(({ bodyMarkdown: _bodyMarkdown, ...item }) => item);
    const last = page.at(-1)?.note;
    const key = last ? input.sort === "title_asc" ? last.title : input.sort === "created_desc" ? last.createdAt.toISOString() : last.updatedAt.toISOString() : undefined;
    return {
      items,
      hasNext,
      invalidCursor,
      courses: await readCourses(tx, user),
      nextCursor: hasNext && last && key ? encodeCursor(user, { key, id: last.id, fingerprint: cursorFingerprint(input), expiresAt: Date.now() + 15 * 60_000 }) : null,
    };
  })),
  get: Effect.fn("Note.get")((user, noteId) => database.withTransaction(user, (tx) => readNote(tx, user, noteId))),
  courses: Effect.fn("Note.courses")((user) => database.withTransaction(user, (tx) => readCourses(tx, user))),
  create: Effect.fn("Note.create")((user, input) => Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(CreateNote)(input);
    return yield* database.withTransaction(user, async (tx) => {
      const prior = await findPrior(tx, user, args.idempotencyKey);
      if (prior) return prior;
      const bodyMarkdown = normalizeMarkdown(args.bodyMarkdown ?? "");
      const fields = validateNote({ title: args.title, bodyMarkdown });
      if (fields.length > 0) { const result = { _tag: "invalid", fields } as const; await saveResult(tx, user, args.idempotencyKey, "note.create", args, result); return result; }
      if (!await verifyCourse(tx, user, args.courseId)) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "note.create", args, result); return result; }
      const inserted = await tx.insert(notes).values({ ownerId: user.id, title: args.title.trim(), bodyMarkdown, courseId: args.courseId ?? null }).returning();
      const row = inserted[0];
      if (!row) return invalid("form", "Note could not be created");
      const value = await readNote(tx, user, row.id);
      if (!value) return { _tag: "not_found" } as const;
      const token = randomBytes(32).toString("base64url");
      const result = { _tag: "applied", value, undoToken: token } as const;
      await saveResult(tx, user, args.idempotencyKey, "note.create", args, result, row.id, 1);
      await saveUndo(tx, user, args.idempotencyKey, token, { kind: "note.create", noteId: row.id }, row.version);
      return result;
    });
  })),
  update: Effect.fn("Note.update")((user, input) => Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(UpdateNote)(input);
    return yield* database.withTransaction(user, async (tx) => {
      const prior = await findPrior(tx, user, args.idempotencyKey);
      if (prior) return prior;
      const currentRows = await tx.select().from(notes).where(and(eq(notes.id, args.noteId), eq(notes.ownerId, user.id), isNull(notes.deletedAt))).limit(1);
      const current = currentRows[0];
      if (!current) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "note.update", args, result, args.noteId, args.expectedVersion); return result; }
      if (current.version !== args.expectedVersion) { const result = { _tag: "conflict", current: await readNote(tx, user, args.noteId) } as const; await saveResult(tx, user, args.idempotencyKey, "note.update", args, result, args.noteId, args.expectedVersion); return result; }
      const bodyMarkdown = normalizeMarkdown(args.bodyMarkdown);
      const fields = validateNote({ title: args.title, bodyMarkdown });
      if (fields.length > 0) { const result = { _tag: "invalid", fields } as const; await saveResult(tx, user, args.idempotencyKey, "note.update", args, result, args.noteId, args.expectedVersion); return result; }
      if (!await verifyCourse(tx, user, args.courseId)) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "note.update", args, result, args.noteId, args.expectedVersion); return result; }
      const changed = await tx.update(notes).set({ title: args.title.trim(), bodyMarkdown, courseId: args.courseId, version: current.version + 1, updatedAt: new Date() }).where(and(eq(notes.id, args.noteId), eq(notes.ownerId, user.id), eq(notes.version, current.version))).returning();
      const row = changed[0];
      if (!row) return { _tag: "conflict" } as const;
      const value = await readNote(tx, user, row.id);
      if (!value) return { _tag: "not_found" } as const;
      const token = randomBytes(32).toString("base64url");
      const result = { _tag: "applied", value, undoToken: token } as const;
      await saveResult(tx, user, args.idempotencyKey, "note.update", args, result, row.id, args.expectedVersion);
      await saveUndo(tx, user, args.idempotencyKey, token, { kind: "note.restore", note: current }, row.version);
      return result;
    });
  })),
  delete: Effect.fn("Note.delete")((user, input) => Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(DeleteNote)(input);
    return yield* database.withTransaction(user, async (tx) => {
      const prior = await findPrior(tx, user, args.idempotencyKey);
      if (prior) return prior;
      const currentRows = await tx.select().from(notes).where(and(eq(notes.id, args.noteId), eq(notes.ownerId, user.id), isNull(notes.deletedAt))).limit(1);
      const current = currentRows[0];
      if (!current) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "note.delete", args, result, args.noteId, args.expectedVersion); return result; }
      if (current.version !== args.expectedVersion) { const result = { _tag: "conflict", current: await readNote(tx, user, args.noteId) } as const; await saveResult(tx, user, args.idempotencyKey, "note.delete", args, result, args.noteId, args.expectedVersion); return result; }
      const changed = await tx.update(notes).set({ deletedAt: new Date(), purgeAfter: new Date(Date.now() + 30 * 86_400_000), version: current.version + 1, updatedAt: new Date() }).where(and(eq(notes.id, current.id), eq(notes.ownerId, user.id), eq(notes.version, current.version))).returning();
      const row = changed[0];
      if (!row) return { _tag: "conflict" } as const;
      const token = randomBytes(32).toString("base64url");
      const result = { _tag: "applied", value: null, undoToken: token } as const;
      await saveResult(tx, user, args.idempotencyKey, "note.delete", args, result, row.id, args.expectedVersion);
      await saveUndo(tx, user, args.idempotencyKey, token, { kind: "note.restore", note: current }, row.version);
      return result;
    });
  })),
  undo: Effect.fn("Note.undo")((user, input) => Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(UndoNoteCommand)(input);
    return yield* database.withTransaction(user, async (tx) => {
      const prior = await findPrior(tx, user, args.idempotencyKey);
      if (prior) return prior;
      const rows = await tx.select().from(undoTokens).where(and(eq(undoTokens.ownerId, user.id), eq(undoTokens.tokenHash, hash(args.token)), isNull(undoTokens.consumedAt), sql`${undoTokens.expiresAt} > now()`)).limit(1).for("update");
      const undo = rows[0];
      if (!undo || !isRecord(undo.inverse)) { const result = { _tag: "conflict" } as const; await saveResult(tx, user, args.idempotencyKey, "note.undo", { token: "[redacted]" }, result); return result; }
      const unsafeUndo = async (): Promise<NoteCommandResult> => {
        const result = { _tag: "conflict" } as const;
        await saveResult(tx, user, args.idempotencyKey, "note.undo", { token: "[redacted]" }, result);
        return result;
      };
      const kind = undo.inverse.kind;
      if (kind === "note.create" && typeof undo.inverse.noteId === "string") {
        const noteId = undo.inverse.noteId;
        const current = await tx.select({ id: notes.id }).from(notes).where(and(eq(notes.id, noteId), eq(notes.ownerId, user.id), eq(notes.version, undo.expectedVersion), isNull(notes.deletedAt))).limit(1);
        if (!current[0]) return unsafeUndo();
        const removed = await tx.update(notes).set({ deletedAt: new Date(), purgeAfter: new Date(Date.now() + 30 * 86_400_000), version: undo.expectedVersion + 1, updatedAt: new Date() }).where(and(eq(notes.id, noteId), eq(notes.ownerId, user.id), eq(notes.version, undo.expectedVersion))).returning();
        if (!removed[0]) return unsafeUndo();
      } else if (kind === "note.restore" && isRecord(undo.inverse.note) && typeof undo.inverse.note.id === "string") {
        const snapshot = undo.inverse.note;
        const noteIdValue = Reflect.get(snapshot, "id");
        if (typeof noteIdValue !== "string") return unsafeUndo();
        const noteId = noteIdValue;
        const current = await tx.select({ id: notes.id }).from(notes).where(and(eq(notes.id, noteId), eq(notes.ownerId, user.id), eq(notes.version, undo.expectedVersion))).limit(1);
        if (!current[0] || typeof snapshot.title !== "string" || typeof snapshot.bodyMarkdown !== "string") return unsafeUndo();
        const courseId = typeof snapshot.courseId === "string" ? snapshot.courseId : null;
        if (!await verifyCourse(tx, user, courseId)) return unsafeUndo();
        await tx.update(notes).set({
          title: snapshot.title,
          bodyMarkdown: snapshot.bodyMarkdown,
          courseId,
          deletedAt: null,
          purgeAfter: null,
          version: undo.expectedVersion + 1,
          updatedAt: new Date(),
        }).where(and(eq(notes.id, noteId), eq(notes.ownerId, user.id), eq(notes.version, undo.expectedVersion)));
      } else return unsafeUndo();
      await tx.update(undoTokens).set({ consumedAt: new Date() }).where(and(eq(undoTokens.id, undo.id), isNull(undoTokens.consumedAt)));
      const result = { _tag: "applied", value: null } as const;
      await saveResult(tx, user, args.idempotencyKey, "note.undo", { token: "[redacted]" }, result);
      return result;
    });
  })),
});

/** Build the Note service from an existing Database service. */
export const noteServiceLayer = Layer.effect(NoteService, Effect.gen(function* () {
  return NoteService.of(makeService(yield* Database));
}));
