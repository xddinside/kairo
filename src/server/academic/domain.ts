import { Schema } from "effect";

const uuid = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)),
);
const title = Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200)));
const details = Schema.String.pipe(Schema.check(Schema.isMaxLength(5_000)));
const code = Schema.String.pipe(Schema.check(Schema.isMaxLength(64)));
const isoDate = Schema.String.pipe(Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)));
const localTime = Schema.String.pipe(Schema.check(Schema.isPattern(/^([01]\d|2[0-3]):[0-5]\d$/)));
const version = Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)));
const idempotencyKey = Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200)));
const pageSize = Schema.Literals([10, 25, 50, 100] as const);

/** Academic lifecycle shared by Tasks and Assessments. */
export const AcademicStatus = Schema.Literals(["open", "completed", "cancelled"] as const);

/** Academic lifecycle value. */
export type AcademicStatus = Schema.Schema.Type<typeof AcademicStatus>;

/** Input for creating a Course. */
export const CreateCourse = Schema.Struct({ title, code: Schema.optionalKey(Schema.NullOr(code)), idempotencyKey });
/** Decoded Course creation input. */
export interface CreateCourse extends Schema.Schema.Type<typeof CreateCourse> {}

/** Input for updating a Course. */
export const UpdateCourse = Schema.Struct({ courseId: uuid, expectedVersion: version, patch: Schema.Struct({ title: Schema.optionalKey(title), code: Schema.optionalKey(Schema.NullOr(code)) }), idempotencyKey });
/** Decoded Course update input. */
export interface UpdateCourse extends Schema.Schema.Type<typeof UpdateCourse> {}

/** Input for a versioned Course lifecycle or deletion command. */
export const ChangeCourse = Schema.Struct({ courseId: uuid, expectedVersion: version, idempotencyKey });
/** Decoded Course lifecycle input. */
export interface ChangeCourse extends Schema.Schema.Type<typeof ChangeCourse> {}

const academicFields = {
  title,
  details: Schema.optionalKey(Schema.NullOr(details)),
  courseId: Schema.optionalKey(Schema.NullOr(uuid)),
  dueDate: Schema.optionalKey(Schema.NullOr(isoDate)),
  dueTime: Schema.optionalKey(Schema.NullOr(localTime)),
};

/** Input for creating a Task. */
export const CreateTask = Schema.Struct({ ...academicFields, assessmentId: Schema.optionalKey(Schema.NullOr(uuid)), idempotencyKey });
/** Decoded Task creation input. */
export interface CreateTask extends Schema.Schema.Type<typeof CreateTask> {}

/** Input for updating editable Task fields. */
export const UpdateTask = Schema.Struct({ taskId: uuid, expectedVersion: version, patch: Schema.Struct({ title: Schema.optionalKey(title), details: Schema.optionalKey(Schema.NullOr(details)), courseId: Schema.optionalKey(Schema.NullOr(uuid)), assessmentId: Schema.optionalKey(Schema.NullOr(uuid)), dueDate: Schema.optionalKey(Schema.NullOr(isoDate)), dueTime: Schema.optionalKey(Schema.NullOr(localTime)) }), idempotencyKey });
/** Decoded Task update input. */
export interface UpdateTask extends Schema.Schema.Type<typeof UpdateTask> {}

/** Input for creating an Assessment. */
export const CreateAssessment = Schema.Struct({ ...academicFields, idempotencyKey });
/** Decoded Assessment creation input. */
export interface CreateAssessment extends Schema.Schema.Type<typeof CreateAssessment> {}

/** Input for updating editable Assessment fields. */
export const UpdateAssessment = Schema.Struct({ assessmentId: uuid, expectedVersion: version, patch: Schema.Struct({ title: Schema.optionalKey(title), details: Schema.optionalKey(Schema.NullOr(details)), courseId: Schema.optionalKey(Schema.NullOr(uuid)), dueDate: Schema.optionalKey(Schema.NullOr(isoDate)), dueTime: Schema.optionalKey(Schema.NullOr(localTime)) }), idempotencyKey });
/** Decoded Assessment update input. */
export interface UpdateAssessment extends Schema.Schema.Type<typeof UpdateAssessment> {}

/** Input for a Task or Assessment status command. */
export const SetAcademicStatus = Schema.Struct({ id: uuid, expectedVersion: version, status: AcademicStatus, idempotencyKey });
/** Decoded academic status input. */
export interface SetAcademicStatus extends Schema.Schema.Type<typeof SetAcademicStatus> {}

/** Input for deleting a Task or Assessment. */
export const DeleteAcademicRecord = Schema.Struct({ id: uuid, expectedVersion: version, idempotencyKey });
/** Decoded academic deletion input. */
export interface DeleteAcademicRecord extends Schema.Schema.Type<typeof DeleteAcademicRecord> {}

/** Input for consuming an academic Undo token. */
export const UndoAcademicCommand = Schema.Struct({ token: Schema.String.pipe(Schema.check(Schema.isMinLength(32), Schema.isMaxLength(256))), idempotencyKey });
/** Decoded academic Undo input. */
export interface UndoAcademicCommand extends Schema.Schema.Type<typeof UndoAcademicCommand> {}

/** Browser-safe Course projection. */
export interface Course {
  readonly id: string;
  readonly title: string;
  readonly code: string | null;
  readonly lifecycle: "current" | "archived";
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A current Course that may be newly selected. */
export interface CourseOption { readonly id: string; readonly title: string; readonly code: string | null }

/** Browser-safe Task projection. */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly details: string | null;
  readonly courseId: string | null;
  readonly courseTitle: string | null;
  readonly assessmentId: string | null;
  readonly assessmentTitle: string | null;
  readonly dueDate: string | null;
  readonly dueTime: string | null;
  readonly status: AcademicStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Browser-safe Assessment projection. */
export interface Assessment {
  readonly id: string;
  readonly title: string;
  readonly details: string | null;
  readonly courseId: string | null;
  readonly courseTitle: string | null;
  readonly dueDate: string | null;
  readonly dueTime: string | null;
  readonly status: AcademicStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A current Assessment that may be newly selected by a Task. */
export interface AssessmentOption { readonly id: string; readonly title: string; readonly courseId: string | null }

/** Owner-scoped Task collection query. */
export const TaskListInput = Schema.Struct({ q: Schema.String, status: Schema.Union([AcademicStatus, Schema.Literal("all")]), courseId: Schema.NullOr(uuid), assessment: Schema.Union([uuid, Schema.Literal("none"), Schema.Null]), window: Schema.Literals(["all", "next7", "custom"] as const), from: Schema.NullOr(isoDate), to: Schema.NullOr(isoDate), sort: Schema.Literals(["due_asc", "updated_desc", "title_asc"] as const), pageSize, cursor: Schema.NullOr(Schema.String) });
/** Decoded Task collection query. */
export interface TaskListInput extends Schema.Schema.Type<typeof TaskListInput> {}

/** Stable Task page returned to routes. */
export interface TaskPage { readonly items: ReadonlyArray<Task>; readonly nextCursor: string | null; readonly hasNext: boolean; readonly invalidCursor: boolean }

/** Owner-scoped Deadline query. */
export const DeadlineListInput = Schema.Struct({ q: Schema.String, kind: Schema.Literals(["all", "task", "assessment"] as const), status: Schema.Union([AcademicStatus, Schema.Literal("all")]), courseId: Schema.NullOr(uuid), from: isoDate, to: isoDate, includeOverdue: Schema.Boolean, pageSize, cursor: Schema.NullOr(Schema.String) });
/** Decoded Deadline query. */
export interface DeadlineListInput extends Schema.Schema.Type<typeof DeadlineListInput> {}

/** One row in the derived Deadline union. */
export type Deadline =
  | { readonly kind: "task"; readonly id: string; readonly title: string; readonly courseId: string | null; readonly courseTitle: string | null; readonly dueDate: string; readonly dueTime: string | null; readonly status: AcademicStatus; readonly version: number; readonly linkedAssessmentId: string | null }
  | { readonly kind: "assessment"; readonly id: string; readonly title: string; readonly courseId: string | null; readonly courseTitle: string | null; readonly dueDate: string; readonly dueTime: string | null; readonly status: AcademicStatus; readonly version: number };

/** Stable derived Deadline page. */
export interface DeadlinePage { readonly items: ReadonlyArray<Deadline>; readonly nextCursor: string | null; readonly hasNext: boolean; readonly invalidCursor: boolean }

/** Field-level mutation failure. */
export interface AcademicFieldError { readonly field: string; readonly message: string }

/** Result returned by Course, Task, Assessment, and Undo mutations. */
export type AcademicCommandResult<T> =
  | { readonly _tag: "applied" | "already_applied"; readonly value: T | null; readonly undoToken?: string }
  | { readonly _tag: "conflict"; readonly reason: "stale_version" | "has_dependents" | "illegal_transition" | "unsafe_undo"; readonly current?: T }
  | { readonly _tag: "not_found" }
  | { readonly _tag: "invalid"; readonly fields: ReadonlyArray<AcademicFieldError> }
  | { readonly _tag: "unavailable"; readonly retryable: boolean; readonly requestId: string };

/** Check an exact Gregorian ISO date rather than only its text shape. */
export const isIsoDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/** Validate cross-field academic record rules. */
export const validateAcademicFields = (value: { readonly title: string; readonly details?: string | null; readonly dueDate?: string | null; readonly dueTime?: string | null }): ReadonlyArray<AcademicFieldError> => {
  const fields: Array<AcademicFieldError> = [];
  const trimmed = value.title.trim();
  if (trimmed.length === 0 || Array.from(trimmed).length > 200) fields.push({ field: "title", message: "Title must be 1-200 characters" });
  if (value.details !== undefined && value.details !== null && Array.from(value.details).length > 5_000) fields.push({ field: "details", message: "Details must be 5,000 characters or less" });
  if (value.dueDate && !isIsoDate(value.dueDate)) fields.push({ field: "dueDate", message: "Enter a valid date" });
  if (value.dueTime && !value.dueDate) fields.push({ field: "dueTime", message: "A due time requires a due date" });
  return fields;
};

/** Check whether a requested status transition is legal. */
export const canTransitionStatus = (from: AcademicStatus, to: AcademicStatus): boolean => from === to || from === "open" || to === "open";
