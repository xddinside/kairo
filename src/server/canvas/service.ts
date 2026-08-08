import { and, desc, eq, ilike, isNull, max, or, sql } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import type { AuthenticatedUser } from "../auth/user";
import { Database, type DatabaseService, type KairoTx } from "../database/service";
import { canvasActivities, canvasOperations, canvases, generatedViews } from "../database/schema";
import {
  AppendCanvasActivity,
  AppendGeneratedView,
  CanvasActivity,
  type CanvasActivityContent,
  CanvasDetail,
  CanvasMutationResult,
  CanvasSummary,
  ChangeCanvasLifecycle,
  CreateCanvas,
  CreateCanvasResult,
  GeneratedView,
  GetCanvas,
  RecentCanvases,
  RenameCanvas,
  SearchCanvases,
} from "./domain";

/** Application service for owner-scoped Canvas persistence. */
export interface CanvasServiceShape {
  readonly recent: (user: AuthenticatedUser, input: unknown) => Effect.Effect<ReadonlyArray<CanvasSummary>, unknown>;
  readonly search: (user: AuthenticatedUser, input: unknown) => Effect.Effect<ReadonlyArray<CanvasSummary>, unknown>;
  readonly get: (user: AuthenticatedUser, input: unknown) => Effect.Effect<CanvasDetail | undefined, unknown>;
  readonly create: (user: AuthenticatedUser, input: unknown) => Effect.Effect<CreateCanvasResult, unknown>;
  readonly appendActivity: (user: AuthenticatedUser, input: unknown) => Effect.Effect<CanvasMutationResult, unknown>;
  readonly appendGeneratedView: (user: AuthenticatedUser, input: unknown) => Effect.Effect<CanvasMutationResult, unknown>;
  readonly rename: (user: AuthenticatedUser, input: unknown) => Effect.Effect<CanvasMutationResult, unknown>;
  readonly archive: (user: AuthenticatedUser, input: unknown) => Effect.Effect<CanvasMutationResult, unknown>;
  readonly restore: (user: AuthenticatedUser, input: unknown) => Effect.Effect<CanvasMutationResult, unknown>;
  readonly delete: (user: AuthenticatedUser, input: unknown) => Effect.Effect<CanvasMutationResult, unknown>;
}

/** Canvas application service tag. */
export class CanvasService extends Context.Service<CanvasService, CanvasServiceShape>()("kairo/server/CanvasService") {}

type CanvasRow = typeof canvases.$inferSelect;
type ActivityRow = typeof canvasActivities.$inferSelect;
type ViewRow = typeof generatedViews.$inferSelect;
type OperationKind = "create" | "append_activity" | "append_view" | "rename" | "archive" | "restore" | "delete";

const serializable = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const summaryFromRow = (row: CanvasRow) => ({
  id: row.id,
  title: row.title,
  state: row.state,
  version: row.version,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const payloadFromContent = (content: CanvasActivityContent): unknown => {
  const { kind: _kind, ...payload } = content;
  return serializable(payload);
};

const contentFromRow = (row: ActivityRow): unknown => ({ kind: row.kind, ...objectPayload(row.payload) });
const objectPayload = (value: unknown): Readonly<Record<string, unknown>> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};

const activityFromRow = (row: ActivityRow) => ({
  id: row.id,
  canvasId: row.canvasId,
  sequence: row.sequence,
  content: contentFromRow(row),
  createdAt: row.createdAt.toISOString(),
});

const viewFromRow = (row: ViewRow) => ({
  id: row.id,
  canvasId: row.canvasId,
  requestActivityId: row.requestActivityId,
  historySequence: row.historySequence,
  catalogVersion: row.catalogVersion,
  schemaVersion: row.schemaVersion,
  modelVersion: row.modelVersion,
  promptVersion: row.promptVersion,
  spec: row.spec,
  rationale: row.rationale,
  evidence: row.evidence,
  createdAt: row.createdAt.toISOString(),
});

const decode = <S extends Schema.Constraint>(schema: S) =>
  Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" });

const lockRequest = async (tx: KairoTx, user: AuthenticatedUser, clientRequestId: string): Promise<void> => {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${user.id}:${clientRequestId}`}, 0))`);
};

const findPrior = async (tx: KairoTx, user: AuthenticatedUser, clientRequestId: string): Promise<unknown | undefined> => {
  const rows = await tx.select({ result: canvasOperations.result }).from(canvasOperations)
    .where(and(eq(canvasOperations.ownerId, user.id), eq(canvasOperations.clientRequestId, clientRequestId))).limit(1);
  return rows[0]?.result ?? undefined;
};

const saveOperation = async (
  tx: KairoTx,
  user: AuthenticatedUser,
  canvasId: string,
  clientRequestId: string,
  kind: OperationKind,
  input: unknown,
  result: unknown,
): Promise<void> => {
  await tx.insert(canvasOperations).values({
    ownerId: user.id,
    canvasId,
    clientRequestId,
    state: "ready",
    payload: { kind, input: serializable(input) },
    result: serializable(result),
  });
};

const lockCanvas = async (tx: KairoTx, user: AuthenticatedUser, canvasId: string): Promise<CanvasRow | undefined> => {
  const rows = await tx.select().from(canvases)
    .where(and(eq(canvases.id, canvasId), eq(canvases.ownerId, user.id), isNull(canvases.deletedAt))).limit(1).for("update");
  return rows[0];
};

const appendActivityRow = async (tx: KairoTx, user: AuthenticatedUser, canvasId: string, content: CanvasActivityContent): Promise<ActivityRow> => {
  const values = await tx.select({ value: max(canvasActivities.sequence) }).from(canvasActivities)
    .where(and(eq(canvasActivities.ownerId, user.id), eq(canvasActivities.canvasId, canvasId)));
  const rows = await tx.insert(canvasActivities).values({
    ownerId: user.id,
    canvasId,
    sequence: (values[0]?.value ?? 0) + 1,
    kind: content.kind,
    payload: payloadFromContent(content),
  }).returning();
  const row = rows[0];
  if (!row) throw new Error("Canvas activity insert returned no row");
  return row;
};

const updateCanvas = async (tx: KairoTx, row: CanvasRow, changes: Partial<Pick<CanvasRow, "title" | "state" | "deletedAt" | "purgeAfter">>): Promise<CanvasRow> => {
  const rows = await tx.update(canvases).set({ ...changes, version: row.version + 1, updatedAt: new Date() })
    .where(and(eq(canvases.id, row.id), eq(canvases.ownerId, row.ownerId), eq(canvases.version, row.version))).returning();
  const changed = rows[0];
  if (!changed) throw new Error("Locked Canvas update returned no row");
  return changed;
};

const readDetail = async (tx: KairoTx, user: AuthenticatedUser, canvasId: string): Promise<unknown | undefined> => {
  const rows = await tx.select().from(canvases).where(and(eq(canvases.id, canvasId), eq(canvases.ownerId, user.id), isNull(canvases.deletedAt))).limit(1);
  const row = rows[0];
  if (!row) return undefined;
  const activities = await tx.select().from(canvasActivities)
    .where(and(eq(canvasActivities.ownerId, user.id), eq(canvasActivities.canvasId, canvasId))).orderBy(canvasActivities.sequence);
  const history = await tx.select().from(generatedViews)
    .where(and(eq(generatedViews.ownerId, user.id), eq(generatedViews.canvasId, canvasId))).orderBy(generatedViews.historySequence);
  return { canvas: summaryFromRow(row), activities: activities.map(activityFromRow), history: history.map(viewFromRow) };
};

const idempotentMutation = (
  database: DatabaseService,
  user: AuthenticatedUser,
  input: { readonly canvasId: string; readonly expectedVersion: number; readonly clientRequestId: string },
  kind: Exclude<OperationKind, "create">,
  apply: (tx: KairoTx, row: CanvasRow) => Promise<CanvasMutationResult>,
): Effect.Effect<CanvasMutationResult, unknown> => database.withTransaction(user, async (tx) => {
  await lockRequest(tx, user, input.clientRequestId);
  const prior = await findPrior(tx, user, input.clientRequestId);
  if (prior !== undefined) return Schema.decodeUnknownPromise(CanvasMutationResult)(prior);
  const current = await lockCanvas(tx, user, input.canvasId);
  if (!current) return { _tag: "not_found" } as const;
  if (current.version !== input.expectedVersion) return { _tag: "conflict", current: summaryFromRow(current) } as const;
  const result = await Schema.decodeUnknownPromise(CanvasMutationResult)(await apply(tx, current), { onExcessProperty: "error" });
  await saveOperation(tx, user, current.id, input.clientRequestId, kind, input, result);
  return result;
});

const makeService = (database: DatabaseService): CanvasServiceShape => ({
  recent: Effect.fn("Canvas.recent")((user, input) => Effect.gen(function* () {
    const args = yield* decode(RecentCanvases)(input);
    const values = yield* database.withTransaction(user, (tx) => tx.select().from(canvases)
      .where(and(eq(canvases.ownerId, user.id), isNull(canvases.deletedAt))).orderBy(desc(canvases.updatedAt), desc(canvases.id)).limit(args.limit));
    return yield* decode(Schema.Array(CanvasSummary))(values.map(summaryFromRow));
  })),
  search: Effect.fn("Canvas.search")((user, input) => Effect.gen(function* () {
    const args = yield* decode(SearchCanvases)(input);
    const state = args.state === "all" ? undefined : eq(canvases.state, args.state);
    const values = yield* database.withTransaction(user, (tx) => tx.select().from(canvases).where(and(
      eq(canvases.ownerId, user.id), isNull(canvases.deletedAt), state,
      or(ilike(canvases.title, `%${args.query.trim()}%`), sql`${canvases.title} is null and ${"Untitled Canvas"} ilike ${`%${args.query.trim()}%`}`),
    )).orderBy(desc(canvases.updatedAt), desc(canvases.id)).limit(args.limit));
    return yield* decode(Schema.Array(CanvasSummary))(values.map(summaryFromRow));
  })),
  get: Effect.fn("Canvas.get")((user, input) => Effect.gen(function* () {
    const args = yield* decode(GetCanvas)(input);
    const value = yield* database.withTransaction(user, (tx) => readDetail(tx, user, args.canvasId));
    return value === undefined ? undefined : yield* decode(CanvasDetail)(value);
  })),
  create: Effect.fn("Canvas.create")((user, input) => Effect.gen(function* () {
    const args = yield* decode(CreateCanvas)(input);
    const value = yield* database.withTransaction(user, async (tx) => {
      await lockRequest(tx, user, args.clientRequestId);
      const prior = await findPrior(tx, user, args.clientRequestId);
      if (prior !== undefined) {
        const result = await Schema.decodeUnknownPromise(CreateCanvasResult)(prior);
        return { ...result, _tag: "already_created" as const };
      }
      const canvasRows = await tx.insert(canvases).values({ ownerId: user.id, title: args.title?.trim() ?? null }).returning();
      const canvas = canvasRows[0];
      if (!canvas) throw new Error("Canvas insert returned no row");
      const activity = await appendActivityRow(tx, user, canvas.id, args.activity);
      const result = { _tag: "created", canvas: summaryFromRow(canvas), activity: activityFromRow(activity) } as const;
      await saveOperation(tx, user, canvas.id, args.clientRequestId, "create", args, result);
      return result;
    });
    return yield* decode(CreateCanvasResult)(value);
  })),
  appendActivity: Effect.fn("Canvas.appendActivity")((user, input) => Effect.gen(function* () {
    const args = yield* decode(AppendCanvasActivity)(input);
    return yield* idempotentMutation(database, user, args, "append_activity", async (tx, current) => {
      if (current.state === "archived") return { _tag: "archived" };
      const activity = await appendActivityRow(tx, user, current.id, args.activity);
      const canvas = await updateCanvas(tx, current, {});
      return { _tag: "activity_appended", canvas: summaryFromRow(canvas), activity: await Schema.decodeUnknownPromise(CanvasActivity)(activityFromRow(activity)) };
    });
  })),
  appendGeneratedView: Effect.fn("Canvas.appendGeneratedView")((user, input) => Effect.gen(function* () {
    const args = yield* decode(AppendGeneratedView)(input);
    return yield* idempotentMutation(database, user, args, "append_view", async (tx, current) => {
      if (current.state === "archived") return { _tag: "archived" };
      if (args.requestActivityId !== null) {
        const request = await tx.select({ id: canvasActivities.id }).from(canvasActivities).where(and(
          eq(canvasActivities.id, args.requestActivityId), eq(canvasActivities.canvasId, current.id), eq(canvasActivities.ownerId, user.id), eq(canvasActivities.kind, "request"),
        )).limit(1);
        if (!request[0]) return { _tag: "not_found" };
      }
      const last = await tx.select({ value: max(generatedViews.historySequence) }).from(generatedViews)
        .where(and(eq(generatedViews.ownerId, user.id), eq(generatedViews.canvasId, current.id)));
      const rows = await tx.insert(generatedViews).values({
        ownerId: user.id,
        canvasId: current.id,
        requestActivityId: args.requestActivityId,
        historySequence: (last[0]?.value ?? 0) + 1,
        catalogVersion: args.catalogVersion,
        schemaVersion: args.schemaVersion,
        modelVersion: args.modelVersion,
        promptVersion: args.promptVersion,
        spec: serializable(args.spec),
        rationale: args.rationale,
        evidence: serializable(args.evidence),
      }).returning();
      const view = rows[0];
      if (!view) throw new Error("Generated view insert returned no row");
      const canvas = await updateCanvas(tx, current, {});
      return { _tag: "view_appended", canvas: summaryFromRow(canvas), view: await Schema.decodeUnknownPromise(GeneratedView)(viewFromRow(view)) };
    });
  })),
  rename: Effect.fn("Canvas.rename")((user, input) => Effect.gen(function* () {
    const args = yield* decode(RenameCanvas)(input);
    return yield* idempotentMutation(database, user, args, "rename", async (tx, current) => {
      const canvas = await updateCanvas(tx, current, { title: args.title.trim() });
      return { _tag: "applied", canvas: summaryFromRow(canvas) };
    });
  })),
  archive: Effect.fn("Canvas.archive")((user, input) => Effect.gen(function* () {
    const args = yield* decode(ChangeCanvasLifecycle)(input);
    return yield* idempotentMutation(database, user, args, "archive", async (tx, current) => {
      const canvas = await updateCanvas(tx, current, { state: "archived" });
      return { _tag: "applied", canvas: summaryFromRow(canvas) };
    });
  })),
  restore: Effect.fn("Canvas.restore")((user, input) => Effect.gen(function* () {
    const args = yield* decode(ChangeCanvasLifecycle)(input);
    return yield* idempotentMutation(database, user, args, "restore", async (tx, current) => {
      const canvas = await updateCanvas(tx, current, { state: "active" });
      return { _tag: "applied", canvas: summaryFromRow(canvas) };
    });
  })),
  delete: Effect.fn("Canvas.delete")((user, input) => Effect.gen(function* () {
    const args = yield* decode(ChangeCanvasLifecycle)(input);
    return yield* idempotentMutation(database, user, args, "delete", async (tx, current) => {
      const canvas = await updateCanvas(tx, current, { deletedAt: new Date(), purgeAfter: new Date(Date.now() + 30 * 86_400_000) });
      return { _tag: "applied", canvas: summaryFromRow(canvas) };
    });
  })),
});

/** Build the Canvas service from an existing Database service. */
export const canvasServiceLayer = Layer.effect(CanvasService, Effect.gen(function* () {
  return CanvasService.of(makeService(yield* Database));
}));
