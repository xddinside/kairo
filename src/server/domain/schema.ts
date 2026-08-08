import { Schema } from "effect";

const uuid = Schema.String.pipe(Schema.check(Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)));
const key = Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200)));
const title = Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200)));
const details = Schema.optional(Schema.NullOr(Schema.String.pipe(Schema.check(Schema.isMaxLength(5000)))));
const isoDate = Schema.String.pipe(Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)));
const localTime = Schema.String.pipe(Schema.check(Schema.isPattern(/^([01]\d|2[0-3]):[0-5]\d$/)));
const version = Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)));

export const AcademicStatus = Schema.Literals(["open", "completed", "cancelled"] as const);
export const TaskId = uuid;
export const AssessmentId = uuid;
export const UserId = Schema.String.pipe(Schema.check(Schema.isPattern(/^user_[A-Za-z0-9_-]+$/)));

export const CreateTaskArgs = Schema.Struct({ title, details, courseId: Schema.optional(Schema.NullOr(uuid)), assessmentId: Schema.optional(Schema.NullOr(uuid)), dueDate: Schema.optional(Schema.NullOr(isoDate)), dueTime: Schema.optional(Schema.NullOr(localTime)) });
export const UpdateTaskArgs = Schema.Struct({ taskId: uuid, expectedVersion: version, patch: Schema.Struct({ title: Schema.optional(title), details, courseId: Schema.optional(Schema.NullOr(uuid)), assessmentId: Schema.optional(Schema.NullOr(uuid)), dueDate: Schema.optional(Schema.NullOr(isoDate)), dueTime: Schema.optional(Schema.NullOr(localTime)) }) });
export const SetStatusArgs = Schema.Struct({ record: Schema.Struct({ kind: Schema.Literals(["task", "assessment"] as const), id: uuid }), expectedVersion: version, status: AcademicStatus });
export const DeleteArgs = Schema.Struct({ record: Schema.Struct({ kind: Schema.Literals(["task", "assessment"] as const), id: uuid }), expectedVersion: version });
export const UndoArgs = Schema.Struct({ token: Schema.String.pipe(Schema.check(Schema.isMinLength(32), Schema.isMaxLength(256))) });

const envelopeBase = { version: Schema.Literal(1), idempotencyKey: key, canvasId: Schema.optional(uuid), sourceActivityId: Schema.optional(uuid) };

export const CommandEnvelope = Schema.Union([
  Schema.Struct({ ...envelopeBase, kind: Schema.Literal("task.create"), args: CreateTaskArgs }),
  Schema.Struct({ ...envelopeBase, kind: Schema.Literal("task.update"), args: UpdateTaskArgs }),
  Schema.Struct({ ...envelopeBase, kind: Schema.Literal("academic.status"), args: SetStatusArgs }),
  Schema.Struct({ ...envelopeBase, kind: Schema.Literal("academic.delete"), args: DeleteArgs }),
  Schema.Struct({ ...envelopeBase, kind: Schema.Literal("undo"), args: UndoArgs }),
]);
export type CommandEnvelope = Schema.Schema.Type<typeof CommandEnvelope>;

export type Task = {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly details: string | null;
  readonly courseId: string | null;
  readonly assessmentId: string | null;
  readonly dueDate: string | null;
  readonly dueTime: string | null;
  readonly status: "open" | "completed" | "cancelled";
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
};

export type Assessment = Task & { readonly kind: "assessment" };
export type CommandValue = Task | Assessment;
export type FieldError = { readonly field: string; readonly message: string };
export type CommandResult =
  | { readonly _tag: "applied" | "already_applied"; readonly value: CommandValue | null; readonly undoToken?: string }
  | { readonly _tag: "conflict"; readonly reason: "stale_version" | "has_dependents" | "unsafe_undo"; readonly current?: CommandValue }
  | { readonly _tag: "not_found" }
  | { readonly _tag: "invalid"; readonly fields: ReadonlyArray<FieldError> }
  | { readonly _tag: "unavailable"; readonly retryable: boolean; readonly requestId: string };
