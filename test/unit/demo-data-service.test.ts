import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import type { AcademicServiceShape } from "../../src/server/academic/service";
import { AcademicService } from "../../src/server/academic/service";
import { requireUserFromSession } from "../../src/server/auth/user";
import { DemoDataService, demoDataServiceLayer } from "../../src/server/demo-data/service";

const user = requireUserFromSession({ _tag: "verified", userId: "user_demo", sessionId: "sess_demo" });
const timestamp = "2026-08-08T12:00:00.000Z";
const id = (value: number) => `123e4567-e89b-42d3-a456-4266141740${value.toString().padStart(2, "0")}`;

describe("demo data service", () => {
  it("uses stable idempotency keys and creates the complete dataset", async () => {
    const keys: Array<string> = [];
    let courseIndex = 0;
    const academic = {
      createCourse: (_user, input: unknown) => {
        const value = input as { readonly idempotencyKey: string; readonly title: string; readonly code: string };
        keys.push(value.idempotencyKey);
        courseIndex += 1;
        return Effect.succeed({ _tag: "applied", value: { id: id(courseIndex), title: value.title, code: value.code, lifecycle: "current", version: 1, createdAt: timestamp, updatedAt: timestamp } } as const);
      },
      createAssessment: (_user, input: unknown) => {
        const value = input as { readonly idempotencyKey: string; readonly title: string; readonly courseId: string };
        keys.push(value.idempotencyKey);
        return Effect.succeed({ _tag: "applied", value: { id: id(10), title: value.title, details: null, courseId: value.courseId, courseTitle: "AI & Neural Networks", dueDate: "2026-08-10", dueTime: "09:00", status: "open", version: 1, createdAt: timestamp, updatedAt: timestamp } } as const);
      },
      createTask: (_user, input: unknown) => {
        const value = input as { readonly idempotencyKey: string; readonly title: string };
        keys.push(value.idempotencyKey);
        return Effect.succeed({ _tag: "applied", value: { id: id(20 + keys.length), title: value.title, details: null, courseId: null, courseTitle: null, assessmentId: null, assessmentTitle: null, dueDate: null, dueTime: null, status: "open", version: 1, createdAt: timestamp, updatedAt: timestamp } } as const);
      },
    } as Pick<AcademicServiceShape, "createCourse" | "createAssessment" | "createTask">;
    const layer = Layer.provide(demoDataServiceLayer, Layer.succeed(AcademicService, academic as AcademicServiceShape));

    const result = await Effect.runPromise(DemoDataService.use((service) => service.seed(user)).pipe(Effect.provide(layer)));

    expect(result).toEqual({ courses: 4, assessments: 1, tasks: 6 });
    expect(keys).toHaveLength(11);
    expect(new Set(keys).size).toBe(11);
    expect(keys.every((key) => key.startsWith("demo-v1:"))).toBe(true);
  });
});
