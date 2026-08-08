import { Schema } from "effect";

const uuid = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)),
);
const nonBlank = (maximum: number) => Schema.String.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(maximum), Schema.isPattern(/\S/)),
);
const version = Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)));
const sequence = Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)));
const clientRequestId = nonBlank(200);
const instant = Schema.String.pipe(Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T/)));
const fileIds = Schema.Array(uuid);

/** Student request activity content. */
export const RequestActivityContent = Schema.Struct({
  kind: Schema.Literal("request"),
  text: nonBlank(10_000),
  sourceViewId: Schema.NullOr(uuid),
  fileIds,
});

/** File attachment activity content. */
export const AttachmentActivityContent = Schema.Struct({
  kind: Schema.Literal("attachment"),
  fileId: uuid,
});

/** Clarification answer activity content. */
export const ClarificationAnswerActivityContent = Schema.Struct({
  kind: Schema.Literal("clarification_answer"),
  questionId: nonBlank(200),
  text: nonBlank(10_000),
});

/** Accepted action activity content. */
export const AcceptedActionActivityContent = Schema.Struct({
  kind: Schema.Literal("accepted_action"),
  action: nonBlank(96),
  input: Schema.Json,
});

/** Strict union of student-facing Canvas activity content. */
export const CanvasActivityContent = Schema.Union([
  RequestActivityContent,
  AttachmentActivityContent,
  ClarificationAnswerActivityContent,
  AcceptedActionActivityContent,
]);

/** Decoded Canvas activity content. */
export type CanvasActivityContent = typeof CanvasActivityContent.Type;

/** Input that atomically creates a Canvas and its first activity. */
export const CreateCanvas = Schema.Struct({
  clientRequestId,
  title: Schema.optionalKey(nonBlank(160)),
  activity: CanvasActivityContent,
});

/** Decoded Canvas creation input. */
export interface CreateCanvas extends Schema.Schema.Type<typeof CreateCanvas> {}

/** Input that appends an ordered activity to an active Canvas. */
export const AppendCanvasActivity = Schema.Struct({
  canvasId: uuid,
  expectedVersion: version,
  clientRequestId,
  activity: CanvasActivityContent,
});

/** Decoded activity append input. */
export interface AppendCanvasActivity extends Schema.Schema.Type<typeof AppendCanvasActivity> {}

const versionedCanvasMutation = {
  canvasId: uuid,
  expectedVersion: version,
  clientRequestId,
};

/** Input that renames a Canvas. */
export const RenameCanvas = Schema.Struct({ ...versionedCanvasMutation, title: nonBlank(160) });

/** Input that archives, restores, or deletes a Canvas. */
export const ChangeCanvasLifecycle = Schema.Struct(versionedCanvasMutation);

/** Input that appends one immutable validated Generated view. */
export const AppendGeneratedView = Schema.Struct({
  ...versionedCanvasMutation,
  requestActivityId: Schema.NullOr(uuid),
  catalogVersion: nonBlank(64),
  schemaVersion: nonBlank(64),
  modelVersion: nonBlank(128),
  promptVersion: nonBlank(64),
  spec: Schema.Json,
  rationale: Schema.NullOr(Schema.String.pipe(Schema.check(Schema.isMaxLength(600)))),
  evidence: Schema.Array(Schema.Json),
});

/** Decoded Generated view append input. */
export interface AppendGeneratedView extends Schema.Schema.Type<typeof AppendGeneratedView> {}

/** Owner-scoped recent Canvas query. */
export const RecentCanvases = Schema.Struct({
  limit: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 }))),
});

/** Owner-scoped Canvas search query. */
export const SearchCanvases = Schema.Struct({
  query: nonBlank(160),
  state: Schema.Literals(["active", "archived", "all"] as const),
  limit: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 }))),
});

/** Owner-scoped Canvas identifier input. */
export const GetCanvas = Schema.Struct({ canvasId: uuid });

/** A saved Canvas summary. */
export const CanvasSummary = Schema.Struct({
  id: uuid,
  title: Schema.NullOr(Schema.String),
  state: Schema.Literals(["active", "archived"] as const),
  version,
  createdAt: instant,
  updatedAt: instant,
});

/** Decoded Canvas summary. */
export type CanvasSummary = typeof CanvasSummary.Type;

/** One immutable ordered Canvas activity. */
export const CanvasActivity = Schema.Struct({
  id: uuid,
  canvasId: uuid,
  sequence,
  content: CanvasActivityContent,
  createdAt: instant,
});

/** Decoded Canvas activity. */
export type CanvasActivity = typeof CanvasActivity.Type;

/** One immutable Generated view history entry. */
export const GeneratedView = Schema.Struct({
  id: uuid,
  canvasId: uuid,
  requestActivityId: Schema.NullOr(uuid),
  historySequence: sequence,
  catalogVersion: nonBlank(64),
  schemaVersion: nonBlank(64),
  modelVersion: nonBlank(128),
  promptVersion: nonBlank(64),
  spec: Schema.Json,
  rationale: Schema.NullOr(Schema.String),
  evidence: Schema.Array(Schema.Json),
  createdAt: instant,
});

/** Decoded Generated view history entry. */
export type GeneratedView = typeof GeneratedView.Type;

/** A Canvas together with its ordered activity and Generated view history. */
export const CanvasDetail = Schema.Struct({
  canvas: CanvasSummary,
  activities: Schema.Array(CanvasActivity),
  history: Schema.Array(GeneratedView),
});

/** Decoded Canvas detail. */
export type CanvasDetail = typeof CanvasDetail.Type;

/** Successful or rejected result of a Canvas mutation. */
export const CanvasMutationResult = Schema.Union([
  Schema.Struct({ _tag: Schema.Literals(["applied", "already_applied"] as const), canvas: CanvasSummary }),
  Schema.Struct({ _tag: Schema.Literal("activity_appended"), canvas: CanvasSummary, activity: CanvasActivity }),
  Schema.Struct({ _tag: Schema.Literal("view_appended"), canvas: CanvasSummary, view: GeneratedView }),
  Schema.Struct({ _tag: Schema.Literal("conflict"), current: CanvasSummary }),
  Schema.Struct({ _tag: Schema.Literal("not_found") }),
  Schema.Struct({ _tag: Schema.Literal("archived") }),
]);

/** Decoded Canvas mutation result. */
export type CanvasMutationResult = typeof CanvasMutationResult.Type;

/** Result of atomically creating a Canvas and its first activity. */
export const CreateCanvasResult = Schema.Struct({
  _tag: Schema.Literals(["created", "already_created"] as const),
  canvas: CanvasSummary,
  activity: CanvasActivity,
});

/** Decoded Canvas creation result. */
export type CreateCanvasResult = typeof CreateCanvasResult.Type;
