import { Effect, Layer } from "effect";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { requireUserFromSession } from "../../src/server/auth/user";
import { databaseLayer, makeDatabaseService } from "../../src/server/database/service";
import { CanvasService, canvasServiceLayer } from "../../src/server/canvas/service";

const url = process.env.KAIRO_DATABASE_TEST_URL;
const run = describe.skipIf(!url);

run("Canvas persistence", () => {
  const alice = requireUserFromSession({ _tag: "verified", userId: "user_canvas_alice", sessionId: "sess_canvas_alice" });
  const bob = requireUserFromSession({ _tag: "verified", userId: "user_canvas_bob", sessionId: "sess_canvas_bob" });
  const database = makeDatabaseService(url ?? "", { runtimeRole: "kairo_runtime", migrationRole: "kairo_migrator" });
  const layer = Layer.provide(canvasServiceLayer, databaseLayer(database));
  const execute = <A>(operation: (service: CanvasService["Service"]) => Effect.Effect<A, unknown>) =>
    Effect.runPromise(CanvasService.use(operation).pipe(Effect.provide(layer)));

  beforeAll(async () => {
    for (const user of [alice, bob]) {
      await Effect.runPromise(database.withTransaction(user, async (tx) => {
        await tx.execute(sql`insert into users (id) values (${user.id}) on conflict (id) do nothing`);
      }));
    }
  });

  afterAll(async () => {
    await Effect.runPromise(database.close());
  });

  it("atomically deduplicates creation and preserves ordered activity and view history", async () => {
    const createInput = {
      clientRequestId: "canvas-create-two-tabs",
      title: "Exam plan",
      activity: { kind: "request", text: "Build an exam plan", sourceViewId: null, fileIds: [] },
    } as const;
    const [first, retry] = await Promise.all([
      execute((service) => service.create(alice, createInput)),
      execute((service) => service.create(alice, createInput)),
    ]);
    expect(new Set([first._tag, retry._tag])).toEqual(new Set(["created", "already_created"]));
    expect(retry.canvas.id).toBe(first.canvas.id);
    expect(retry.activity.id).toBe(first.activity.id);
    expect(first.activity.sequence).toBe(1);

    const appended = await execute((service) => service.appendActivity(alice, {
      canvasId: first.canvas.id,
      expectedVersion: 1,
      clientRequestId: "canvas-activity-2",
      activity: { kind: "clarification_answer", questionId: "scope", text: "Two weeks" },
    }));
    expect(appended._tag).toBe("activity_appended");
    if (appended._tag !== "activity_appended") throw new Error("Activity was not appended");
    expect(appended.activity.sequence).toBe(2);

    const view = await execute((service) => service.appendGeneratedView(alice, {
      canvasId: first.canvas.id,
      expectedVersion: appended.canvas.version,
      clientRequestId: "canvas-view-1",
      requestActivityId: first.activity.id,
      catalogVersion: "catalog-1",
      schemaVersion: "schema-1",
      modelVersion: "model-1",
      promptVersion: "prompt-1",
      spec: { root: { type: "Stack", children: [] } },
      rationale: "Orders the study work.",
      evidence: [],
    }));
    expect(view._tag).toBe("view_appended");
    if (view._tag !== "view_appended") throw new Error("Generated view was not appended");
    expect(view.view.historySequence).toBe(1);

    const detail = await execute((service) => service.get(alice, { canvasId: first.canvas.id }));
    expect(detail?.activities.map(({ sequence }) => sequence)).toEqual([1, 2]);
    expect(detail?.history.map(({ historySequence }) => historySequence)).toEqual([1]);
    expect(detail?.history[0]?.spec).toEqual({ root: { type: "Stack", children: [] } });

    const foreign = await execute((service) => service.get(bob, { canvasId: first.canvas.id }));
    const missing = await execute((service) => service.get(bob, { canvasId: "123e4567-e89b-42d3-a456-426614174000" }));
    expect(foreign).toBeUndefined();
    expect(missing).toBeUndefined();

    const renamed = await execute((service) => service.rename(alice, {
      canvasId: first.canvas.id,
      expectedVersion: view.canvas.version,
      clientRequestId: "canvas-rename-1",
      title: "Final exam plan",
    }));
    expect(renamed._tag).toBe("applied");
    if (renamed._tag !== "applied") throw new Error("Canvas was not renamed");

    const stale = await execute((service) => service.archive(alice, {
      canvasId: first.canvas.id,
      expectedVersion: view.canvas.version,
      clientRequestId: "canvas-archive-stale",
    }));
    expect(stale._tag).toBe("conflict");

    const archived = await execute((service) => service.archive(alice, {
      canvasId: first.canvas.id,
      expectedVersion: renamed.canvas.version,
      clientRequestId: "canvas-archive-1",
    }));
    expect(archived._tag).toBe("applied");
    if (archived._tag !== "applied") throw new Error("Canvas was not archived");
    const rejected = await execute((service) => service.appendActivity(alice, {
      canvasId: first.canvas.id,
      expectedVersion: archived.canvas.version,
      clientRequestId: "canvas-archived-append",
      activity: { kind: "request", text: "Do not append", sourceViewId: null, fileIds: [] },
    }));
    expect(rejected).toEqual({ _tag: "archived" });

    const restored = await execute((service) => service.restore(alice, {
      canvasId: first.canvas.id,
      expectedVersion: archived.canvas.version,
      clientRequestId: "canvas-restore-1",
    }));
    expect(restored._tag).toBe("applied");
    if (restored._tag !== "applied") throw new Error("Canvas was not restored");
    const deleted = await execute((service) => service.delete(alice, {
      canvasId: first.canvas.id,
      expectedVersion: restored.canvas.version,
      clientRequestId: "canvas-delete-1",
    }));
    expect(deleted._tag).toBe("applied");
    expect(await execute((service) => service.get(alice, { canvasId: first.canvas.id }))).toBeUndefined();
  });
});
