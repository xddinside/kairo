import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import type { AcademicServiceShape } from "../../src/server/academic/service";
import { AcademicService } from "../../src/server/academic/service";
import { requireUserFromSession } from "../../src/server/auth/user";
import type { CanvasServiceShape } from "../../src/server/canvas/service";
import { CanvasService } from "../../src/server/canvas/service";
import { ModelGateway } from "../../src/server/generation/gateway";
import { GenerationService, generationServiceLayer } from "../../src/server/generation/service";

const user = requireUserFromSession({ _tag: "verified", userId: "user_generation", sessionId: "sess_generation" });
const canvasId = "123e4567-e89b-42d3-a456-426614174000";
const activityId = "123e4567-e89b-42d3-a456-426614174001";
const taskId = "123e4567-e89b-42d3-a456-426614174002";
const timestamp = "2026-08-08T12:00:00.000Z";

const detail = {
  canvas: { id: canvasId, title: "Plan", state: "active", version: 1, createdAt: timestamp, updatedAt: timestamp },
  activities: [{ id: activityId, canvasId, sequence: 1, content: { kind: "request", text: "Plan today", sourceViewId: null, fileIds: [] }, createdAt: timestamp }],
  history: [],
} as const;

const task = { id: taskId, title: "Review", details: null, courseId: null, courseTitle: null, assessmentId: null, assessmentTitle: null, dueDate: null, dueTime: null, status: "open", version: 1, createdAt: timestamp, updatedAt: timestamp } as const;

const makeCanvas = (saved: Array<unknown>): CanvasServiceShape => ({
  get: () => Effect.succeed(detail),
  appendGeneratedView: (_user, input) => { saved.push(input); return Effect.succeed({ _tag: "view_appended", canvas: { ...detail.canvas, version: 2 }, view: { id: taskId, canvasId, requestActivityId: activityId, historySequence: 1, catalogVersion: "1", schemaVersion: "1", modelVersion: "1", promptVersion: "1", spec: {}, rationale: null, evidence: [], createdAt: timestamp } }); },
  recent: () => Effect.succeed([]), search: () => Effect.succeed([]), create: () => Effect.die("unused"), appendActivity: () => Effect.die("unused"), rename: () => Effect.die("unused"), archive: () => Effect.die("unused"), restore: () => Effect.die("unused"), delete: () => Effect.die("unused"),
});

const academic: AcademicServiceShape = {
  listCourses: () => Effect.succeed([]),
  listTasks: () => Effect.succeed({ items: [task], nextCursor: null, hasNext: false, invalidCursor: false }),
  workloadRange: () => Effect.succeed({ from: "2026-08-08", to: "2026-08-14", timeZone: "UTC" }),
  getCourse: () => Effect.die("unused"), courseOptions: () => Effect.die("unused"), createCourse: () => Effect.die("unused"), updateCourse: () => Effect.die("unused"), archiveCourse: () => Effect.die("unused"), reopenCourse: () => Effect.die("unused"), deleteCourse: () => Effect.die("unused"), getTask: () => Effect.die("unused"), createTask: () => Effect.die("unused"), updateTask: () => Effect.die("unused"), setTaskStatus: () => Effect.die("unused"), deleteTask: () => Effect.die("unused"), getAssessment: () => Effect.die("unused"), assessmentOptions: () => Effect.die("unused"), createAssessment: () => Effect.die("unused"), updateAssessment: () => Effect.die("unused"), setAssessmentStatus: () => Effect.die("unused"), deleteAssessment: () => Effect.die("unused"), listDeadlines: () => Effect.die("unused"), undo: () => Effect.die("unused"),
};

const runGeneration = (responses: ReadonlyArray<string>, saved: Array<unknown>) => {
  let index = 0;
  const dependencies = Layer.mergeAll(
    Layer.succeed(CanvasService, makeCanvas(saved)),
    Layer.succeed(AcademicService, academic),
    Layer.succeed(ModelGateway, { complete: () => Effect.succeed(responses[index++] ?? "{}") }),
  );
  const layer = Layer.provide(generationServiceLayer, dependencies);
  return Effect.runPromise(GenerationService.use((service) => service.generate(user, { canvasId, requestActivityId: activityId, expectedVersion: 1, clientRequestId: "generate-1" })).pipe(Effect.provide(layer)));
};

describe("Canvas generation service", () => {
  it("repairs one malformed completion and persists only the valid view", async () => {
    const saved: Array<unknown> = [];
    const result = await runGeneration(["not json", JSON.stringify({ kind: "view", spec: { title: "Today", blocks: [{ type: "TaskList", heading: "Tasks", taskIds: [taskId] }] } })], saved);
    expect(result).toEqual({ _tag: "view_ready" });
    expect(saved).toHaveLength(1);
  });

  it("preserves history when both completion attempts are invalid", async () => {
    const saved: Array<unknown> = [];
    const result = await runGeneration(["not json", "still not json"], saved);
    expect(result).toEqual({ _tag: "failed", retryable: false });
    expect(saved).toHaveLength(0);
  });
});
