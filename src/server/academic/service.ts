import { createHash, createHmac, randomBytes } from "node:crypto";
import { and, asc, desc, eq, ilike, isNull, lt, or, sql } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import type { AuthenticatedUser } from "../auth/user";
import { Database, type DatabaseService, type KairoTx } from "../database/service";
import { assessments, courses, domainCommands, files, focusSessions, notes, tasks, timetableEntries, undoTokens, users } from "../database/schema";
import {
  canTransitionStatus,
  ChangeCourse,
  CreateAssessment,
  CreateCourse,
  CreateTask,
  DeadlineListInput,
  DeleteAcademicRecord,
  type AcademicCommandResult,
  type AcademicStatus,
  type Assessment,
  type AssessmentOption,
  type Course,
  type CourseOption,
  type Deadline,
  type DeadlinePage,
  SetAcademicStatus,
  TaskListInput,
  type Task,
  type TaskPage,
  UndoAcademicCommand,
  UpdateAssessment,
  UpdateCourse,
  UpdateTask,
  validateAcademicFields,
} from "./domain";

/** Application service for production Courses, Tasks, Assessments, and Deadlines. */
export interface AcademicServiceShape {
  readonly workloadRange: (user: AuthenticatedUser) => Effect.Effect<{ readonly from: string; readonly to: string; readonly timeZone: string }, unknown>;
  readonly listCourses: (user: AuthenticatedUser, lifecycle: "current" | "archived" | "all") => Effect.Effect<ReadonlyArray<Course>, unknown>;
  readonly getCourse: (user: AuthenticatedUser, courseId: string) => Effect.Effect<Course | undefined, unknown>;
  readonly courseOptions: (user: AuthenticatedUser) => Effect.Effect<ReadonlyArray<CourseOption>, unknown>;
  readonly createCourse: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly updateCourse: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly archiveCourse: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly reopenCourse: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly deleteCourse: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly listTasks: (user: AuthenticatedUser, input: TaskListInput) => Effect.Effect<TaskPage, unknown>;
  readonly getTask: (user: AuthenticatedUser, taskId: string) => Effect.Effect<Task | undefined, unknown>;
  readonly createTask: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly updateTask: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly setTaskStatus: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly deleteTask: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly getAssessment: (user: AuthenticatedUser, assessmentId: string) => Effect.Effect<Assessment | undefined, unknown>;
  readonly assessmentOptions: (user: AuthenticatedUser) => Effect.Effect<ReadonlyArray<AssessmentOption>, unknown>;
  readonly createAssessment: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly updateAssessment: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly setAssessmentStatus: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly deleteAssessment: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
  readonly listDeadlines: (user: AuthenticatedUser, input: DeadlineListInput) => Effect.Effect<DeadlinePage, unknown>;
  readonly undo: (user: AuthenticatedUser, input: unknown) => Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown>;
}

/** Academic application service tag. */
export class AcademicService extends Context.Service<AcademicService, AcademicServiceShape>()("kairo/server/AcademicService") {}

type CourseRow = typeof courses.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;
type AssessmentRow = typeof assessments.$inferSelect;
type Entity = Course | Task | Assessment;
type CommandKind = "course.create" | "course.update" | "course.archive" | "course.reopen" | "course.delete" | "task.create" | "task.update" | "task.status" | "task.delete" | "assessment.create" | "assessment.update" | "assessment.status" | "assessment.delete" | "academic.undo";
type Cursor = { readonly key: string; readonly id: string; readonly fingerprint: string; readonly expiresAt: number };

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const serializable = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null;
const optionalTime = (value: string | null): string | null => value ? value.slice(0, 5) : null;

const dateInTimeZone = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
};

const plusDays = (date: string, days: number): string => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const readWorkloadRange = async (tx: KairoTx, user: AuthenticatedUser): Promise<{ readonly from: string; readonly to: string; readonly timeZone: string }> => {
  const rows = await tx.select({ timeZone: users.timeZone }).from(users).where(eq(users.id, user.id)).limit(1);
  const timeZone = rows[0]?.timeZone ?? "UTC";
  const from = dateInTimeZone(new Date(), timeZone);
  return { from, to: plusDays(from, 6), timeZone };
};

const projectCourse = (row: CourseRow): Course => ({ id: row.id, title: row.title, code: row.code, lifecycle: row.archivedAt ? "archived" : "current", version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
const projectTask = (row: TaskRow, courseTitle: string | null, assessmentTitle: string | null): Task => ({ id: row.id, title: row.title, details: row.details, courseId: row.courseId, courseTitle, assessmentId: row.assessmentId, assessmentTitle, dueDate: row.dueDate, dueTime: optionalTime(row.dueTime), status: row.status, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
const projectAssessment = (row: AssessmentRow, courseTitle: string | null): Assessment => ({ id: row.id, title: row.title, details: row.details, courseId: row.courseId, courseTitle, dueDate: row.dueDate, dueTime: optionalTime(row.dueTime), status: row.status, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

const readCourse = async (tx: KairoTx, user: AuthenticatedUser, courseId: string): Promise<Course | undefined> => {
  const rows = await tx.select().from(courses).where(and(eq(courses.id, courseId), eq(courses.ownerId, user.id), isNull(courses.deletedAt))).limit(1);
  return rows[0] ? projectCourse(rows[0]) : undefined;
};
const readTask = async (tx: KairoTx, user: AuthenticatedUser, taskId: string): Promise<Task | undefined> => {
  const rows = await tx.select({ task: tasks, courseTitle: courses.title, assessmentTitle: assessments.title }).from(tasks)
    .leftJoin(courses, and(eq(courses.id, tasks.courseId), eq(courses.ownerId, user.id), isNull(courses.deletedAt)))
    .leftJoin(assessments, and(eq(assessments.id, tasks.assessmentId), eq(assessments.ownerId, user.id), isNull(assessments.deletedAt)))
    .where(and(eq(tasks.id, taskId), eq(tasks.ownerId, user.id), isNull(tasks.deletedAt))).limit(1);
  const value = rows[0];
  return value ? projectTask(value.task, value.courseTitle, value.assessmentTitle) : undefined;
};
const readAssessment = async (tx: KairoTx, user: AuthenticatedUser, assessmentId: string): Promise<Assessment | undefined> => {
  const rows = await tx.select({ assessment: assessments, courseTitle: courses.title }).from(assessments)
    .leftJoin(courses, and(eq(courses.id, assessments.courseId), eq(courses.ownerId, user.id), isNull(courses.deletedAt)))
    .where(and(eq(assessments.id, assessmentId), eq(assessments.ownerId, user.id), isNull(assessments.deletedAt))).limit(1);
  const value = rows[0];
  return value ? projectAssessment(value.assessment, value.courseTitle) : undefined;
};

const validCourse = async (tx: KairoTx, user: AuthenticatedUser, courseId: string | null | undefined): Promise<boolean> => {
  if (!courseId) return true;
  const rows = await tx.select({ id: courses.id }).from(courses).where(and(eq(courses.id, courseId), eq(courses.ownerId, user.id), isNull(courses.archivedAt), isNull(courses.deletedAt))).limit(1);
  return Boolean(rows[0]);
};
const validAssessment = async (tx: KairoTx, user: AuthenticatedUser, assessmentId: string | null | undefined): Promise<boolean> => {
  if (!assessmentId) return true;
  const rows = await tx.select({ id: assessments.id }).from(assessments).where(and(eq(assessments.id, assessmentId), eq(assessments.ownerId, user.id), eq(assessments.status, "open"), isNull(assessments.deletedAt))).limit(1);
  return Boolean(rows[0]);
};

const priorResult = <T extends Entity>(value: unknown): AcademicCommandResult<T> | undefined => {
  if (!isRecord(value) || typeof value._tag !== "string") return undefined;
  if (value._tag === "not_found") return { _tag: "not_found" };
  if (value._tag === "unavailable" && typeof value.retryable === "boolean" && typeof value.requestId === "string") return { _tag: "unavailable", retryable: value.retryable, requestId: value.requestId };
  if (value._tag === "invalid" && Array.isArray(value.fields)) return { _tag: "invalid", fields: value.fields.flatMap((field) => isRecord(field) && typeof field.field === "string" && typeof field.message === "string" ? [{ field: field.field, message: field.message }] : []) };
  if (value._tag === "conflict" && (value.reason === "stale_version" || value.reason === "has_dependents" || value.reason === "illegal_transition" || value.reason === "unsafe_undo")) return { _tag: "conflict", reason: value.reason };
  if ((value._tag === "applied" || value._tag === "already_applied") && (value.value === null || isRecord(value.value))) {
    // SAFETY: persisted command results originate from this service after projection; the structural envelope is checked above.
    const projected = value.value as T | null;
    return { _tag: "already_applied", value: projected, ...(typeof value.undoToken === "string" ? { undoToken: value.undoToken } : {}) };
  }
  return undefined;
};

const findPrior = async <T extends Entity>(tx: KairoTx, user: AuthenticatedUser, idempotencyKey: string): Promise<AcademicCommandResult<T> | undefined> => {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${user.id}:${idempotencyKey}`}, 0))`);
  const rows = await tx.select({ result: domainCommands.result }).from(domainCommands).where(and(eq(domainCommands.ownerId, user.id), eq(domainCommands.idempotencyKey, idempotencyKey))).limit(1);
  return rows[0] ? priorResult<T>(rows[0].result) : undefined;
};

const saveResult = async <T extends Entity>(tx: KairoTx, user: AuthenticatedUser, idempotencyKey: string, kind: CommandKind, args: unknown, result: AcademicCommandResult<T>, targetType: "course" | "task" | "assessment" | null, targetId?: string, expectedVersion?: number): Promise<void> => {
  await tx.insert(domainCommands).values({ ownerId: user.id, idempotencyKey, commandVersion: 1, kind, targetType, targetId: targetId ?? null, expectedVersion: expectedVersion ?? null, state: result._tag === "already_applied" ? "already_applied" : result._tag, args: serializable(args), result: serializable(result), errorCode: result._tag === "conflict" ? result.reason : result._tag === "invalid" ? "invalid" : null, completedAt: new Date() });
};
const saveUndo = async (tx: KairoTx, user: AuthenticatedUser, idempotencyKey: string, token: string, inverse: unknown, expectedVersion: number): Promise<void> => {
  await tx.insert(undoTokens).values({ ownerId: user.id, commandId: sql`(select id from domain_commands where owner_id = ${user.id} and idempotency_key = ${idempotencyKey})`, tokenHash: hash(token), inverse: serializable(inverse), expectedVersion, expiresAt: new Date(Date.now() + 30_000) });
};
const token = (): string => randomBytes(32).toString("base64url");
const invalid = <T extends Entity>(field: string, message: string): AcademicCommandResult<T> => ({ _tag: "invalid", fields: [{ field, message }] });

const cursorSignature = (user: AuthenticatedUser, payload: string): string => createHmac("sha256", user.sessionId).update(payload).digest("base64url");
const encodeCursor = (user: AuthenticatedUser, cursor: Cursor): string => { const payload = Buffer.from(JSON.stringify(cursor)).toString("base64url"); return `${payload}.${cursorSignature(user, payload)}`; };
const decodeCursor = (user: AuthenticatedUser, encoded: string | null, fingerprint: string): Cursor | undefined => {
  if (!encoded) return undefined;
  const [payload, signature, extra] = encoded.split(".");
  if (!payload || !signature || extra || signature !== cursorSignature(user, payload)) return undefined;
  try {
    const value: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!isRecord(value) || typeof value.key !== "string" || typeof value.id !== "string" || value.fingerprint !== fingerprint || typeof value.expiresAt !== "number" || value.expiresAt <= Date.now()) return undefined;
    return { key: value.key, id: value.id, fingerprint, expiresAt: value.expiresAt };
  } catch { return undefined; }
};

const taskFingerprint = (input: TaskListInput): string => hash(JSON.stringify({ ...input, cursor: null }));
const deadlineFingerprint = (input: DeadlineListInput): string => hash(JSON.stringify({ ...input, cursor: null }));
const cursorFor = (user: AuthenticatedUser, key: string, id: string, fingerprint: string): string => encodeCursor(user, { key, id, fingerprint, expiresAt: Date.now() + 15 * 60_000 });

const courseDependents = async (tx: KairoTx, user: AuthenticatedUser, courseId: string): Promise<boolean> => {
  const checks = await Promise.all([
    tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.ownerId, user.id), eq(tasks.courseId, courseId), isNull(tasks.deletedAt))).limit(1),
    tx.select({ id: assessments.id }).from(assessments).where(and(eq(assessments.ownerId, user.id), eq(assessments.courseId, courseId), isNull(assessments.deletedAt))).limit(1),
    tx.select({ id: timetableEntries.id }).from(timetableEntries).where(and(eq(timetableEntries.ownerId, user.id), eq(timetableEntries.courseId, courseId), isNull(timetableEntries.deletedAt))).limit(1),
    tx.select({ id: notes.id }).from(notes).where(and(eq(notes.ownerId, user.id), eq(notes.courseId, courseId), isNull(notes.deletedAt))).limit(1),
    tx.select({ id: files.id }).from(files).where(and(eq(files.ownerId, user.id), eq(files.courseId, courseId), isNull(files.deletedAt))).limit(1),
    tx.select({ id: focusSessions.id }).from(focusSessions).where(and(eq(focusSessions.ownerId, user.id), eq(focusSessions.courseId, courseId))).limit(1),
  ]);
  return checks.some((rows) => Boolean(rows[0]));
};

const makeService = (database: DatabaseService): AcademicServiceShape => ({
  workloadRange: Effect.fn("Academic.workloadRange")((user) => database.withTransaction(user, (tx) => readWorkloadRange(tx, user))),
  listCourses: Effect.fn("Academic.listCourses")((user, lifecycle) => database.withTransaction(user, async (tx) => {
    const filters = [eq(courses.ownerId, user.id), isNull(courses.deletedAt)];
    if (lifecycle === "current") filters.push(isNull(courses.archivedAt));
    if (lifecycle === "archived") filters.push(sql`${courses.archivedAt} is not null`);
    const rows = await tx.select().from(courses).where(and(...filters)).orderBy(asc(courses.title), asc(courses.id));
    return rows.map(projectCourse);
  })),
  getCourse: Effect.fn("Academic.getCourse")((user, courseId) => database.withTransaction(user, (tx) => readCourse(tx, user, courseId))),
  courseOptions: Effect.fn("Academic.courseOptions")((user) => database.withTransaction(user, (tx) => tx.select({ id: courses.id, title: courses.title, code: courses.code }).from(courses).where(and(eq(courses.ownerId, user.id), isNull(courses.archivedAt), isNull(courses.deletedAt))).orderBy(asc(courses.title), asc(courses.id)))),
  createCourse: Effect.fn("Academic.createCourse")((user, input) => Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(CreateCourse)(input);
    return yield* database.withTransaction(user, async (tx) => {
      const prior = await findPrior<Course>(tx, user, args.idempotencyKey); if (prior) return prior;
      if (!args.title.trim()) { const result = invalid<Course>("title", "Enter a title"); await saveResult(tx, user, args.idempotencyKey, "course.create", args, result, "course"); return result; }
      const rows = await tx.insert(courses).values({ ownerId: user.id, title: args.title.trim(), code: args.code?.trim() || null }).returning();
      const row = rows[0]; if (!row) return invalid<Course>("form", "Course could not be created");
      const value = projectCourse(row); const undoToken = token(); const result = { _tag: "applied", value, undoToken } as const;
      await saveResult(tx, user, args.idempotencyKey, "course.create", args, result, "course", row.id, 1); await saveUndo(tx, user, args.idempotencyKey, undoToken, { kind: "course.create", id: row.id }, row.version); return result;
    });
  })),
  updateCourse: Effect.fn("Academic.updateCourse")((user, input) => Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(UpdateCourse)(input);
    return yield* database.withTransaction(user, async (tx) => {
      const prior = await findPrior<Course>(tx, user, args.idempotencyKey); if (prior) return prior;
      const rows = await tx.select().from(courses).where(and(eq(courses.id, args.courseId), eq(courses.ownerId, user.id), isNull(courses.deletedAt))).limit(1); const current = rows[0];
      if (!current) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "course.update", args, result, "course", args.courseId, args.expectedVersion); return result; }
      if (current.version !== args.expectedVersion) { const result = { _tag: "conflict", reason: "stale_version", current: projectCourse(current) } as const; await saveResult(tx, user, args.idempotencyKey, "course.update", args, result, "course", args.courseId, args.expectedVersion); return result; }
      if (args.patch.title !== undefined && !args.patch.title.trim()) { const result = invalid<Course>("title", "Enter a title"); await saveResult(tx, user, args.idempotencyKey, "course.update", args, result, "course", args.courseId, args.expectedVersion); return result; }
      const changed = await tx.update(courses).set({ ...(args.patch.title === undefined ? {} : { title: args.patch.title.trim() }), ...(args.patch.code === undefined ? {} : { code: args.patch.code?.trim() || null }), version: current.version + 1, updatedAt: new Date() }).where(and(eq(courses.id, current.id), eq(courses.ownerId, user.id), eq(courses.version, current.version))).returning(); const row = changed[0];
      if (!row) return { _tag: "conflict", reason: "stale_version", current: projectCourse(current) } as const;
      const value = projectCourse(row); const undoToken = token(); const result = { _tag: "applied", value, undoToken } as const; await saveResult(tx, user, args.idempotencyKey, "course.update", args, result, "course", row.id, args.expectedVersion); await saveUndo(tx, user, args.idempotencyKey, undoToken, { kind: "course.restore", row: current }, row.version); return result;
    });
  })),
  archiveCourse: courseLifecycle(database, "archive"),
  reopenCourse: courseLifecycle(database, "reopen"),
  deleteCourse: courseLifecycle(database, "delete"),
  listTasks: Effect.fn("Academic.listTasks")((user, input) => database.withTransaction(user, async (tx) => {
    const workloadRange = input.window === "next7" ? await readWorkloadRange(tx, user) : undefined;
    const effectiveInput = workloadRange ? { ...input, from: workloadRange.from, to: workloadRange.to } : input;
    const fingerprint = taskFingerprint(effectiveInput); const cursor = decodeCursor(user, input.cursor, fingerprint); const normalizedQuery = input.q.trim().normalize("NFKC").slice(0, 100); const filters = [eq(tasks.ownerId, user.id), isNull(tasks.deletedAt)];
    if (normalizedQuery) filters.push(ilike(tasks.title, `%${normalizedQuery.replace(/[\\%_]/g, "\\$&")}%`));
    if (input.status !== "all") filters.push(eq(tasks.status, input.status)); if (input.courseId) filters.push(eq(tasks.courseId, input.courseId)); if (input.assessment === "none") filters.push(isNull(tasks.assessmentId)); else if (input.assessment) filters.push(eq(tasks.assessmentId, input.assessment));
    if (effectiveInput.window !== "all" && effectiveInput.from && effectiveInput.to) { const range = and(sql`${tasks.dueDate} >= ${effectiveInput.from}`, sql`${tasks.dueDate} <= ${effectiveInput.to}`); if (range) filters.push(range); }
    if (cursor) {
      if (input.sort === "title_asc") filters.push(sql`(lower(${tasks.title}), ${tasks.id}) > (${cursor.key}, ${cursor.id}::uuid)`);
      else if (input.sort === "updated_desc") { const date = new Date(cursor.key); const beforeUpdate = or(lt(tasks.updatedAt, date), and(eq(tasks.updatedAt, date), lt(tasks.id, cursor.id))); if (beforeUpdate) filters.push(beforeUpdate); }
      else filters.push(sql`(concat(coalesce(${tasks.dueDate}::text, '9999-12-31'), '|', case when ${tasks.dueTime} is null then '1' else '0' end, '|', coalesce(left(${tasks.dueTime}::text, 5), '99:99'), '|', lower(${tasks.title})), ${tasks.id}) > (${cursor.key}, ${cursor.id}::uuid)`);
    }
    const order = input.sort === "title_asc" ? [sql`lower(${tasks.title})`, asc(tasks.id)] : input.sort === "updated_desc" ? [desc(tasks.updatedAt), desc(tasks.id)] : [sql`${tasks.dueDate} asc nulls last`, sql`${tasks.dueTime} asc nulls last`, sql`lower(${tasks.title})`, asc(tasks.id)];
    const rows = await tx.select({ task: tasks, courseTitle: courses.title, assessmentTitle: assessments.title }).from(tasks).leftJoin(courses, and(eq(courses.id, tasks.courseId), eq(courses.ownerId, user.id), isNull(courses.deletedAt))).leftJoin(assessments, and(eq(assessments.id, tasks.assessmentId), eq(assessments.ownerId, user.id), isNull(assessments.deletedAt))).where(and(...filters)).orderBy(...order).limit(input.pageSize + 1);
    const page = rows.slice(0, input.pageSize); const last = page.at(-1)?.task; const key = last ? input.sort === "title_asc" ? last.title.toLocaleLowerCase() : input.sort === "updated_desc" ? last.updatedAt.toISOString() : `${last.dueDate ?? "9999-12-31"}|${last.dueTime ? "0" : "1"}|${optionalTime(last.dueTime) ?? "99:99"}|${last.title.toLocaleLowerCase()}` : undefined;
    return { items: page.map((row) => projectTask(row.task, row.courseTitle, row.assessmentTitle)), hasNext: rows.length > input.pageSize, invalidCursor: Boolean(input.cursor && !cursor), nextCursor: rows.length > input.pageSize && last && key ? cursorFor(user, key, last.id, fingerprint) : null };
  })),
  getTask: Effect.fn("Academic.getTask")((user, taskId) => database.withTransaction(user, (tx) => readTask(tx, user, taskId))),
  createTask: createAcademic(database, "task"), updateTask: updateAcademic(database, "task"), setTaskStatus: setStatus(database, "task"), deleteTask: deleteAcademic(database, "task"),
  getAssessment: Effect.fn("Academic.getAssessment")((user, assessmentId) => database.withTransaction(user, (tx) => readAssessment(tx, user, assessmentId))),
  assessmentOptions: Effect.fn("Academic.assessmentOptions")((user) => database.withTransaction(user, (tx) => tx.select({ id: assessments.id, title: assessments.title, courseId: assessments.courseId }).from(assessments).where(and(eq(assessments.ownerId, user.id), eq(assessments.status, "open"), isNull(assessments.deletedAt))).orderBy(asc(assessments.title), asc(assessments.id)))),
  createAssessment: createAcademic(database, "assessment"), updateAssessment: updateAcademic(database, "assessment"), setAssessmentStatus: setStatus(database, "assessment"), deleteAssessment: deleteAcademic(database, "assessment"),
  listDeadlines: Effect.fn("Academic.listDeadlines")((user, input) => database.withTransaction(user, (tx) => listDeadlines(tx, user, input))),
  undo: Effect.fn("Academic.undo")((user, input) => undoAcademic(database, user, input)),
});

const courseLifecycle = (database: DatabaseService, operation: "archive" | "reopen" | "delete"): AcademicServiceShape[`${typeof operation}Course`] => Effect.fn(`Academic.${operation}Course`)((user, input) => Effect.gen(function* () {
  const args = yield* Schema.decodeUnknownEffect(ChangeCourse)(input);
  return yield* database.withTransaction(user, async (tx) => {
    const prior = await findPrior<Course>(tx, user, args.idempotencyKey); if (prior) return prior;
    const rows = await tx.select().from(courses).where(and(eq(courses.id, args.courseId), eq(courses.ownerId, user.id), isNull(courses.deletedAt))).limit(1); const current = rows[0]; const kind = `course.${operation}` as const;
    if (!current) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, kind, args, result, "course", args.courseId, args.expectedVersion); return result; }
    if (current.version !== args.expectedVersion) { const result = { _tag: "conflict", reason: "stale_version", current: projectCourse(current) } as const; await saveResult(tx, user, args.idempotencyKey, kind, args, result, "course", args.courseId, args.expectedVersion); return result; }
    if (operation === "archive" && current.archivedAt || operation === "reopen" && !current.archivedAt) { const result = { _tag: "conflict", reason: "illegal_transition", current: projectCourse(current) } as const; await saveResult(tx, user, args.idempotencyKey, kind, args, result, "course", args.courseId, args.expectedVersion); return result; }
    if (operation === "delete" && await courseDependents(tx, user, current.id)) { const result = { _tag: "conflict", reason: "has_dependents", current: projectCourse(current) } as const; await saveResult(tx, user, args.idempotencyKey, kind, args, result, "course", args.courseId, args.expectedVersion); return result; }
    const now = new Date(); const changed = await tx.update(courses).set(operation === "delete" ? { deletedAt: now, purgeAfter: new Date(now.getTime() + 30 * 86_400_000), version: current.version + 1, updatedAt: now } : { archivedAt: operation === "archive" ? now : null, version: current.version + 1, updatedAt: now }).where(and(eq(courses.id, current.id), eq(courses.ownerId, user.id), eq(courses.version, current.version))).returning(); const row = changed[0];
    if (!row) return { _tag: "conflict", reason: "stale_version", current: projectCourse(current) } as const;
    const undoToken = token(); const result = { _tag: "applied", value: operation === "delete" ? null : projectCourse(row), undoToken } as const; await saveResult(tx, user, args.idempotencyKey, kind, args, result, "course", row.id, args.expectedVersion); await saveUndo(tx, user, args.idempotencyKey, undoToken, { kind: "course.restore", row: current }, row.version); return result;
  });
}));

function createAcademic(database: DatabaseService, entity: "task" | "assessment"): AcademicServiceShape["createTask"] {
  return Effect.fn(`Academic.create.${entity}`)((user: AuthenticatedUser, input: unknown) => Effect.gen(function* () {
  const args = entity === "task" ? yield* Schema.decodeUnknownEffect(CreateTask)(input) : yield* Schema.decodeUnknownEffect(CreateAssessment)(input);
  return yield* database.withTransaction(user, async (tx) => {
    const prior = entity === "task" ? await findPrior<Task>(tx, user, args.idempotencyKey) : await findPrior<Assessment>(tx, user, args.idempotencyKey); if (prior) return prior;
    const fields = validateAcademicFields(args); if (fields.length) { const result = { _tag: "invalid", fields } as const; await saveResult(tx, user, args.idempotencyKey, `${entity}.create`, args, result, entity); return result; }
    const assessmentId = "assessmentId" in args && (typeof args.assessmentId === "string" || args.assessmentId === null) ? args.assessmentId : undefined;
    if (!await validCourse(tx, user, args.courseId) || entity === "task" && !await validAssessment(tx, user, assessmentId)) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, `${entity}.create`, args, result, entity); return result; }
    if (entity === "task") {
      const rows = await tx.insert(tasks).values({ ownerId: user.id, title: args.title.trim(), details: args.details ?? null, courseId: args.courseId ?? null, assessmentId: assessmentId ?? null, dueDate: args.dueDate ?? null, dueTime: args.dueTime ?? null }).returning(); const row = rows[0]; if (!row) return invalid<Task>("form", "Task could not be created"); const value = await readTask(tx, user, row.id); if (!value) return { _tag: "not_found" } as const; const undoToken = token(); const result = { _tag: "applied", value, undoToken } as const; await saveResult(tx, user, args.idempotencyKey, "task.create", args, result, "task", row.id, 1); await saveUndo(tx, user, args.idempotencyKey, undoToken, { kind: "task.create", id: row.id }, row.version); return result;
    }
    const rows = await tx.insert(assessments).values({ ownerId: user.id, title: args.title.trim(), details: args.details ?? null, courseId: args.courseId ?? null, dueDate: args.dueDate ?? null, dueTime: args.dueTime ?? null }).returning(); const row = rows[0]; if (!row) return invalid<Assessment>("form", "Assessment could not be created"); const value = await readAssessment(tx, user, row.id); if (!value) return { _tag: "not_found" } as const; const undoToken = token(); const result = { _tag: "applied", value, undoToken } as const; await saveResult(tx, user, args.idempotencyKey, "assessment.create", args, result, "assessment", row.id, 1); await saveUndo(tx, user, args.idempotencyKey, undoToken, { kind: "assessment.create", id: row.id }, row.version); return result;
  });
  }));
}

function updateAcademic(database: DatabaseService, entity: "task" | "assessment"): AcademicServiceShape["updateTask"] {
  return Effect.fn(`Academic.update.${entity}`)((user: AuthenticatedUser, input: unknown) => Effect.gen(function* () {
  const args = entity === "task" ? yield* Schema.decodeUnknownEffect(UpdateTask)(input) : yield* Schema.decodeUnknownEffect(UpdateAssessment)(input); const id = entity === "task" ? "taskId" in args ? args.taskId : "" : "assessmentId" in args ? args.assessmentId : "";
  return yield* database.withTransaction(user, async (tx) => {
    const prior = entity === "task" ? await findPrior<Task>(tx, user, args.idempotencyKey) : await findPrior<Assessment>(tx, user, args.idempotencyKey); if (prior) return prior;
    if (entity === "task") {
      const rows = await tx.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.ownerId, user.id), isNull(tasks.deletedAt))).limit(1); const current = rows[0]; if (!current) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "task.update", args, result, "task", id, args.expectedVersion); return result; } const currentValue = await readTask(tx, user, id); if (current.version !== args.expectedVersion) { const result = { _tag: "conflict", reason: "stale_version", ...(currentValue ? { current: currentValue } : {}) } as const; await saveResult(tx, user, args.idempotencyKey, "task.update", args, result, "task", id, args.expectedVersion); return result; }
      const patch = "taskId" in args ? args.patch : {}; const candidate = { title: patch.title ?? current.title, details: patch.details === undefined ? current.details : patch.details, dueDate: patch.dueDate === undefined ? current.dueDate : patch.dueDate, dueTime: patch.dueTime === undefined ? optionalTime(current.dueTime) : patch.dueTime }; const fields = validateAcademicFields(candidate); if (fields.length) { const result = { _tag: "invalid", fields } as const; await saveResult(tx, user, args.idempotencyKey, "task.update", args, result, "task", id, args.expectedVersion); return result; } if (patch.courseId !== undefined && !await validCourse(tx, user, patch.courseId) || patch.assessmentId !== undefined && !await validAssessment(tx, user, patch.assessmentId)) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "task.update", args, result, "task", id, args.expectedVersion); return result; }
      const changed = await tx.update(tasks).set({ ...patch, ...(patch.title === undefined ? {} : { title: patch.title.trim() }), version: current.version + 1, updatedAt: new Date() }).where(and(eq(tasks.id, id), eq(tasks.ownerId, user.id), eq(tasks.version, current.version))).returning(); const row = changed[0]; if (!row) return { _tag: "conflict", reason: "stale_version", ...(currentValue ? { current: currentValue } : {}) } as const; const value = await readTask(tx, user, id); if (!value) return { _tag: "not_found" } as const; const undoToken = token(); const result = { _tag: "applied", value, undoToken } as const; await saveResult(tx, user, args.idempotencyKey, "task.update", args, result, "task", id, args.expectedVersion); await saveUndo(tx, user, args.idempotencyKey, undoToken, { kind: "task.restore", row: current }, row.version); return result;
    }
    const rows = await tx.select().from(assessments).where(and(eq(assessments.id, id), eq(assessments.ownerId, user.id), isNull(assessments.deletedAt))).limit(1); const current = rows[0]; if (!current) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "assessment.update", args, result, "assessment", id, args.expectedVersion); return result; } const currentValue = await readAssessment(tx, user, id); if (current.version !== args.expectedVersion) { const result = { _tag: "conflict", reason: "stale_version", ...(currentValue ? { current: currentValue } : {}) } as const; await saveResult(tx, user, args.idempotencyKey, "assessment.update", args, result, "assessment", id, args.expectedVersion); return result; }
    const patch = "assessmentId" in args ? args.patch : {}; const fields = validateAcademicFields({ title: patch.title ?? current.title, details: patch.details === undefined ? current.details : patch.details, dueDate: patch.dueDate === undefined ? current.dueDate : patch.dueDate, dueTime: patch.dueTime === undefined ? optionalTime(current.dueTime) : patch.dueTime }); if (fields.length) { const result = { _tag: "invalid", fields } as const; await saveResult(tx, user, args.idempotencyKey, "assessment.update", args, result, "assessment", id, args.expectedVersion); return result; } if (patch.courseId !== undefined && !await validCourse(tx, user, patch.courseId)) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, args.idempotencyKey, "assessment.update", args, result, "assessment", id, args.expectedVersion); return result; }
    const changed = await tx.update(assessments).set({ ...patch, ...(patch.title === undefined ? {} : { title: patch.title.trim() }), version: current.version + 1, updatedAt: new Date() }).where(and(eq(assessments.id, id), eq(assessments.ownerId, user.id), eq(assessments.version, current.version))).returning(); const row = changed[0]; if (!row) return { _tag: "conflict", reason: "stale_version", ...(currentValue ? { current: currentValue } : {}) } as const; const value = await readAssessment(tx, user, id); if (!value) return { _tag: "not_found" } as const; const undoToken = token(); const result = { _tag: "applied", value, undoToken } as const; await saveResult(tx, user, args.idempotencyKey, "assessment.update", args, result, "assessment", id, args.expectedVersion); await saveUndo(tx, user, args.idempotencyKey, undoToken, { kind: "assessment.restore", row: current }, row.version); return result;
  });
  }));
}

function setStatus(database: DatabaseService, entity: "task" | "assessment"): AcademicServiceShape["setTaskStatus"] {
  return Effect.fn(`Academic.status.${entity}`)((user: AuthenticatedUser, input: unknown) => Effect.gen(function* () {
  const args = yield* Schema.decodeUnknownEffect(SetAcademicStatus)(input);
  return yield* database.withTransaction(user, async (tx) => mutateAcademicRow(tx, user, entity, args.id, args.expectedVersion, args.idempotencyKey, `${entity}.status`, args, async (row) => {
    if (!canTransitionStatus(row.status, args.status)) return { _tag: "conflict", reason: "illegal_transition" } as const;
    return { changes: { status: args.status, version: row.version + 1, updatedAt: new Date() }, inverse: { kind: `${entity}.restore`, row } };
  }));
  }));
}

function deleteAcademic(database: DatabaseService, entity: "task" | "assessment"): AcademicServiceShape["deleteTask"] {
  return Effect.fn(`Academic.delete.${entity}`)((user: AuthenticatedUser, input: unknown) => Effect.gen(function* () {
  const args = yield* Schema.decodeUnknownEffect(DeleteAcademicRecord)(input);
  return yield* database.withTransaction(user, async (tx) => mutateAcademicRow(tx, user, entity, args.id, args.expectedVersion, args.idempotencyKey, `${entity}.delete`, args, async (row) => {
    if (entity === "assessment") { const linked = await tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.ownerId, user.id), eq(tasks.assessmentId, row.id), isNull(tasks.deletedAt))).limit(1); if (linked[0]) return { _tag: "conflict", reason: "has_dependents" } as const; }
    const now = new Date(); return { changes: { deletedAt: now, purgeAfter: new Date(now.getTime() + 30 * 86_400_000), version: row.version + 1, updatedAt: now }, inverse: { kind: `${entity}.restore`, row }, deleted: true };
  }));
  }));
}

const mutateAcademicRow = async (tx: KairoTx, user: AuthenticatedUser, entity: "task" | "assessment", id: string, expectedVersion: number, idempotencyKey: string, kind: "task.status" | "assessment.status" | "task.delete" | "assessment.delete", args: unknown, decide: (row: TaskRow | AssessmentRow) => Promise<{ readonly changes: Record<string, unknown>; readonly inverse: unknown; readonly deleted?: boolean } | { readonly _tag: "conflict"; readonly reason: "has_dependents" | "illegal_transition" }>): Promise<AcademicCommandResult<Task> | AcademicCommandResult<Assessment>> => {
  const prior = entity === "task" ? await findPrior<Task>(tx, user, idempotencyKey) : await findPrior<Assessment>(tx, user, idempotencyKey); if (prior) return prior;
  const table = entity === "task" ? tasks : assessments; const rows = await tx.select().from(table).where(and(eq(table.id, id), eq(table.ownerId, user.id), isNull(table.deletedAt))).limit(1); const row = rows[0];
  if (!row) { const result = { _tag: "not_found" } as const; await saveResult(tx, user, idempotencyKey, kind, args, result, entity, id, expectedVersion); return result; }
  const current = entity === "task" ? await readTask(tx, user, id) : await readAssessment(tx, user, id); if (row.version !== expectedVersion) { const result = { _tag: "conflict", reason: "stale_version", ...(current ? { current } : {}) } as const; await saveResult(tx, user, idempotencyKey, kind, args, result, entity, id, expectedVersion); return result; }
  const decision = await decide(row); if ("_tag" in decision) { const result = { ...decision, ...(current ? { current } : {}) }; await saveResult(tx, user, idempotencyKey, kind, args, result, entity, id, expectedVersion); return result; }
  const changed = await tx.update(table).set(decision.changes).where(and(eq(table.id, id), eq(table.ownerId, user.id), eq(table.version, row.version))).returning(); const changedRow = changed[0]; if (!changedRow) return { _tag: "conflict", reason: "stale_version", ...(current ? { current } : {}) };
  const value = decision.deleted ? null : entity === "task" ? await readTask(tx, user, id) : await readAssessment(tx, user, id); const undoToken = token(); const result = { _tag: "applied", value: value ?? null, undoToken } as const; await saveResult(tx, user, idempotencyKey, kind, args, result, entity, id, expectedVersion); await saveUndo(tx, user, idempotencyKey, undoToken, decision.inverse, changedRow.version); return result;
};

const listDeadlines = async (tx: KairoTx, user: AuthenticatedUser, input: DeadlineListInput): Promise<DeadlinePage> => {
  const fingerprint = deadlineFingerprint(input); const cursor = decodeCursor(user, input.cursor, fingerprint); const q = input.q.trim().normalize("NFKC").slice(0, 100); const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await tx.execute<{ kind: "task" | "assessment"; id: string; title: string; course_id: string | null; course_title: string | null; due_date: string; due_time: string | null; status: AcademicStatus; version: number; linked_assessment_id: string | null; sort_key: string }>(sql`
    with deadline_rows as (
      select 'task'::text kind, t.id, t.title, t.course_id, c.title course_title, t.due_date::text, left(t.due_time::text, 5) due_time, t.status::text, t.version, t.assessment_id linked_assessment_id
      from tasks t left join courses c on c.id = t.course_id and c.owner_id = ${user.id} and c.deleted_at is null
      where t.owner_id = ${user.id} and t.deleted_at is null and t.due_date is not null
      union all
      select 'assessment'::text kind, a.id, a.title, a.course_id, c.title course_title, a.due_date::text, left(a.due_time::text, 5) due_time, a.status::text, a.version, null::uuid linked_assessment_id
      from assessments a left join courses c on c.id = a.course_id and c.owner_id = ${user.id} and c.deleted_at is null
      where a.owner_id = ${user.id} and a.deleted_at is null and a.due_date is not null
    )
    select *, concat(due_date, '|', case when due_time is null then '1' else '0' end, '|', coalesce(due_time, '99:99'), '|', case when kind = 'task' then '0' else '1' end, '|', lower(title)) sort_key
    from deadline_rows
    where (${input.kind} = 'all' or kind = ${input.kind}) and (${input.status} = 'all' or status = ${input.status}) and (${input.courseId}::uuid is null or course_id = ${input.courseId}::uuid) and (${q} = '' or title ilike ${pattern})
      and ((due_date between ${input.from} and ${input.to}) or (${input.includeOverdue} and status = 'open' and due_date < ${input.from}))
      and (${cursor?.key ?? null}::text is null or (concat(due_date, '|', case when due_time is null then '1' else '0' end, '|', coalesce(due_time, '99:99'), '|', case when kind = 'task' then '0' else '1' end, '|', lower(title)), id) > (${cursor?.key ?? null}, ${cursor?.id ?? null}::uuid))
    order by due_date, due_time asc nulls last, kind desc, lower(title), id limit ${input.pageSize + 1}
  `);
  const page = rows.slice(0, input.pageSize); const items: Array<Deadline> = page.map((row) => row.kind === "task" ? { kind: "task", id: row.id, title: row.title, courseId: row.course_id, courseTitle: row.course_title, dueDate: row.due_date, dueTime: row.due_time, status: row.status, version: row.version, linkedAssessmentId: row.linked_assessment_id } : { kind: "assessment", id: row.id, title: row.title, courseId: row.course_id, courseTitle: row.course_title, dueDate: row.due_date, dueTime: row.due_time, status: row.status, version: row.version }); const last = page.at(-1);
  return { items, hasNext: rows.length > input.pageSize, invalidCursor: Boolean(input.cursor && !cursor), nextCursor: rows.length > input.pageSize && last ? cursorFor(user, last.sort_key, last.id, fingerprint) : null };
};

const undoAcademic = (database: DatabaseService, user: AuthenticatedUser, input: unknown): Effect.Effect<AcademicCommandResult<Course | Task | Assessment>, unknown> => Effect.gen(function* () {
  const args = yield* Schema.decodeUnknownEffect(UndoAcademicCommand)(input);
  return yield* database.withTransaction(user, async (tx) => {
    const prior = await findPrior<Course | Task | Assessment>(tx, user, args.idempotencyKey); if (prior) return prior;
    const rows = await tx.select().from(undoTokens).where(and(eq(undoTokens.ownerId, user.id), eq(undoTokens.tokenHash, hash(args.token)), isNull(undoTokens.consumedAt), sql`${undoTokens.expiresAt} > now()`)).limit(1).for("update"); const undo = rows[0];
    if (!undo || !isRecord(undo.inverse) || typeof undo.inverse.kind !== "string") { const result = { _tag: "conflict", reason: "unsafe_undo" } as const; await saveResult(tx, user, args.idempotencyKey, "academic.undo", { token: "[redacted]" }, result, null); return result; }
    const kind = undo.inverse.kind; const id = undo.inverse.id; const snapshot = undo.inverse.row; let changed = false;
    if ((kind === "course.create" || kind === "task.create" || kind === "assessment.create") && typeof id === "string") { const table = kind === "course.create" ? courses : kind === "task.create" ? tasks : assessments; const removed = await tx.delete(table).where(and(eq(table.id, id), eq(table.ownerId, user.id), eq(table.version, undo.expectedVersion))).returning({ id: table.id }); changed = Boolean(removed[0]); }
    else if ((kind === "course.restore" || kind === "task.restore" || kind === "assessment.restore") && isRecord(snapshot) && typeof snapshot.id === "string") {
      if (kind === "course.restore" && typeof snapshot.title === "string") { const updated = await tx.update(courses).set({ title: snapshot.title, code: typeof snapshot.code === "string" ? snapshot.code : null, archivedAt: snapshot.archivedAt ? new Date(String(snapshot.archivedAt)) : null, deletedAt: null, purgeAfter: null, version: undo.expectedVersion + 1, updatedAt: new Date() }).where(and(eq(courses.id, snapshot.id), eq(courses.ownerId, user.id), eq(courses.version, undo.expectedVersion))).returning({ id: courses.id }); changed = Boolean(updated[0]); }
      if (kind === "task.restore" && typeof snapshot.title === "string" && (snapshot.status === "open" || snapshot.status === "completed" || snapshot.status === "cancelled")) { const updated = await tx.update(tasks).set({ title: snapshot.title, details: typeof snapshot.details === "string" ? snapshot.details : null, courseId: typeof snapshot.courseId === "string" ? snapshot.courseId : null, assessmentId: typeof snapshot.assessmentId === "string" ? snapshot.assessmentId : null, dueDate: typeof snapshot.dueDate === "string" ? snapshot.dueDate : null, dueTime: typeof snapshot.dueTime === "string" ? snapshot.dueTime : null, status: snapshot.status, deletedAt: null, purgeAfter: null, version: undo.expectedVersion + 1, updatedAt: new Date() }).where(and(eq(tasks.id, snapshot.id), eq(tasks.ownerId, user.id), eq(tasks.version, undo.expectedVersion))).returning({ id: tasks.id }); changed = Boolean(updated[0]); }
      if (kind === "assessment.restore" && typeof snapshot.title === "string" && (snapshot.status === "open" || snapshot.status === "completed" || snapshot.status === "cancelled")) { const updated = await tx.update(assessments).set({ title: snapshot.title, details: typeof snapshot.details === "string" ? snapshot.details : null, courseId: typeof snapshot.courseId === "string" ? snapshot.courseId : null, dueDate: typeof snapshot.dueDate === "string" ? snapshot.dueDate : null, dueTime: typeof snapshot.dueTime === "string" ? snapshot.dueTime : null, status: snapshot.status, deletedAt: null, purgeAfter: null, version: undo.expectedVersion + 1, updatedAt: new Date() }).where(and(eq(assessments.id, snapshot.id), eq(assessments.ownerId, user.id), eq(assessments.version, undo.expectedVersion))).returning({ id: assessments.id }); changed = Boolean(updated[0]); }
    }
    if (!changed) { const result = { _tag: "conflict", reason: "unsafe_undo" } as const; await saveResult(tx, user, args.idempotencyKey, "academic.undo", { token: "[redacted]" }, result, null); return result; }
    await tx.update(undoTokens).set({ consumedAt: new Date() }).where(and(eq(undoTokens.id, undo.id), isNull(undoTokens.consumedAt))); const result = { _tag: "applied", value: null } as const; await saveResult(tx, user, args.idempotencyKey, "academic.undo", { token: "[redacted]" }, result, null); return result;
  });
});

/** Build the academic service from the production Database service. */
export const academicServiceLayer = Layer.effect(AcademicService, Effect.gen(function* () { return AcademicService.of(makeService(yield* Database)); }));
