import { Schema } from "effect";

const uuid = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)),
);
const text = (maximum: number) => Schema.String.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(maximum), Schema.isPattern(/\S/)),
);

/** A bounded explanatory block in a Generated view. */
export const SummaryBlock = Schema.Struct({
  type: Schema.Literal("Summary"),
  heading: text(120),
  body: text(1_000),
});

/** A bounded list of owner-scoped Tasks in a Generated view. */
export const TaskListBlock = Schema.Struct({
  type: Schema.Literal("TaskList"),
  heading: text(120),
  taskIds: Schema.Array(uuid).pipe(Schema.check(Schema.isMaxLength(12))),
});

/** An approved Task creation surface in a Generated view. */
export const TaskCreatorBlock = Schema.Struct({
  type: Schema.Literal("TaskCreator"),
  heading: text(120),
});

/** Complete declarative view accepted from the model boundary. */
export const GeneratedViewSpec = Schema.Struct({
  title: text(160),
  blocks: Schema.Array(Schema.Union([SummaryBlock, TaskListBlock, TaskCreatorBlock])).pipe(
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(8)),
  ),
});

/** Decoded Generated view specification. */
export interface GeneratedViewSpec extends Schema.Schema.Type<typeof GeneratedViewSpec> {}

/** Kairo-owned model result; provider response shapes never cross the gateway. */
export const ModelResult = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("view"),
    spec: GeneratedViewSpec,
    rationale: Schema.optionalKey(text(600)),
  }),
  Schema.Struct({
    kind: Schema.Literal("clarification"),
    questionId: text(96),
    question: text(300),
  }),
]);

/** Decoded model result. */
export type ModelResult = typeof ModelResult.Type;

/** Input for generating from one persisted request activity. */
export const GenerateCanvasView = Schema.Struct({
  canvasId: uuid,
  requestActivityId: uuid,
  expectedVersion: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  clientRequestId: text(200),
});

/** Decoded generation input. */
export interface GenerateCanvasView extends Schema.Schema.Type<typeof GenerateCanvasView> {}

/** Result returned to the Canvas host after a generation attempt. */
export type GenerationResult =
  | { readonly _tag: "view_ready" }
  | { readonly _tag: "clarification_required"; readonly questionId: string; readonly question: string }
  | { readonly _tag: "conflict" }
  | { readonly _tag: "not_found" }
  | { readonly _tag: "failed"; readonly retryable: boolean };

/** Parse model JSON and reject references outside the deterministic owner-scoped context. */
export const decodeModelResult = (
  input: unknown,
  taskIds: ReadonlySet<string>,
): Promise<ModelResult> => Schema.decodeUnknownPromise(ModelResult)(input, { onExcessProperty: "error" }).then((result) => {
  if (result.kind === "view") {
    const hasForeignReference = result.spec.blocks.some((block) =>
      block.type === "TaskList" && block.taskIds.some((taskId) => !taskIds.has(taskId)),
    );
    if (hasForeignReference) return Promise.reject(new Error("Generated view referenced a Task outside the authorized context"));
  }
  return result;
});
