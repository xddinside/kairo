import { Context, Effect, Layer, Schema } from "effect";

import { AcademicService } from "../academic/service";
import type { AuthenticatedUser } from "../auth/user";
import { CanvasService } from "../canvas/service";
import { decodeModelResult, GenerateCanvasView, type GenerationResult, type ModelResult } from "./domain";
import { ModelGateway, ModelGatewayError, type ModelGatewayShape } from "./gateway";

const catalogVersion = "kairo-catalog-1";
const schemaVersion = "generated-view-1";
const promptVersion = "canvas-prototype-1";
const modelVersion = "deepseek-v4-flash";

/** Application service for bounded Canvas generation. */
export interface GenerationServiceShape {
  readonly generate: (user: AuthenticatedUser, input: unknown) => Effect.Effect<GenerationResult, unknown>;
}

/** Canvas generation service tag. */
export class GenerationService extends Context.Service<GenerationService, GenerationServiceShape>()("kairo/server/GenerationService") {}

const systemPrompt = `You compose a Kairo student workspace. Return JSON only.
The only valid results are:
{"kind":"view","spec":{"title":"...","blocks":[...]},"rationale":"..."}
or {"kind":"clarification","questionId":"...","question":"..."}.
Approved blocks are Summary {type, heading, body}, TaskList {type, heading, taskIds}, and TaskCreator {type, heading}.
Use only Task ids present in context. Never emit HTML, CSS, URLs, code, handlers, actions, state bindings, or unknown fields.
Prefer a useful view immediately. Ask one concise clarification only when the request cannot be answered from the context.`;

const parseJson = (content: string): unknown => JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));

const decodeCompletion = (
  content: string,
  taskIds: ReadonlySet<string>,
): Effect.Effect<ModelResult, ModelGatewayError> => Effect.tryPromise({
  try: async () => decodeModelResult(parseJson(content), taskIds),
  catch: () => new ModelGatewayError({ category: "invalid_response", retryable: false }),
});

const runModel = (
  gateway: ModelGatewayShape,
  context: string,
  taskIds: ReadonlySet<string>,
): Effect.Effect<ModelResult | { readonly kind: "failure"; readonly retryable: boolean }> => gateway.complete(systemPrompt, context).pipe(
  Effect.flatMap((first) => decodeCompletion(first, taskIds).pipe(
    Effect.catchTag("Kairo.ModelGatewayError", (error) => {
      if (error.category !== "invalid_response") return Effect.fail(error);
      return gateway.complete(`${systemPrompt}\nYour previous response was invalid. Repair it to exactly match the contract.`, JSON.stringify({ context: JSON.parse(context), invalidOutput: first.slice(0, 8_000) })).pipe(
        Effect.flatMap((content) => decodeCompletion(content, taskIds)),
      );
    }),
  )),
  Effect.catch((error) => Effect.succeed({ kind: "failure", retryable: error.retryable } as const)),
);

/** Build generation from the existing Canvas, academic, and provider services. */
export const generationServiceLayer = Layer.effect(GenerationService, Effect.gen(function* () {
  const canvas = yield* CanvasService;
  const academic = yield* AcademicService;
  const gateway = yield* ModelGateway;

  const generate = Effect.fn("Generation.generate")((user: AuthenticatedUser, input: unknown) => Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(GenerateCanvasView)(input, { onExcessProperty: "error" });
    const detail = yield* canvas.get(user, { canvasId: args.canvasId });
    if (!detail) return { _tag: "not_found" } as const;
    if (detail.canvas.state !== "active" || detail.canvas.version !== args.expectedVersion) return { _tag: "conflict" } as const;
    const activity = detail.activities.find((candidate) => candidate.id === args.requestActivityId && candidate.content.kind === "request");
    if (!activity || activity.content.kind !== "request") return { _tag: "not_found" } as const;

    const [courses, taskPage, range] = yield* Effect.all([
      academic.listCourses(user, "current"),
      academic.listTasks(user, { q: "", status: "all", courseId: null, assessment: null, window: "all", from: null, to: null, sort: "due_asc", pageSize: 100, cursor: null }),
      academic.workloadRange(user),
    ]);
    const context = JSON.stringify({
      contextVersion: "academic-context-1",
      request: activity.content.text.slice(0, 4_000),
      timezone: range.timeZone,
      today: range.from,
      courses,
      tasks: taskPage.items,
      currentView: detail.history.at(-1)?.spec ?? null,
      recentActivities: detail.activities.slice(-12).map(({ content }) => content),
    });
    const taskIds = new Set(taskPage.items.map(({ id }) => id));
    const decoded = yield* runModel(gateway, context, taskIds);
    if (decoded.kind === "failure") return { _tag: "failed", retryable: decoded.retryable } as const;
    if (decoded.kind === "clarification") {
      return { _tag: "clarification_required", questionId: decoded.questionId, question: decoded.question } as const;
    }
    const persisted = yield* canvas.appendGeneratedView(user, {
      canvasId: args.canvasId,
      expectedVersion: args.expectedVersion,
      clientRequestId: args.clientRequestId,
      requestActivityId: args.requestActivityId,
      catalogVersion,
      schemaVersion,
      modelVersion,
      promptVersion,
      spec: decoded.spec,
      rationale: decoded.rationale ?? null,
      evidence: decoded.spec.blocks.flatMap((block) => block.type === "TaskList" ? block.taskIds.map((id) => ({ type: "task", id })) : []),
    });
    if (persisted._tag === "view_appended") return { _tag: "view_ready" } as const;
    if (persisted._tag === "not_found") return { _tag: "not_found" } as const;
    return { _tag: "conflict" } as const;
  }));

  return GenerationService.of({ generate });
}));
