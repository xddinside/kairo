import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import postgres from "postgres";

import { AcademicService, academicServiceLayer } from "../../src/server/academic/service";
import { requireUserFromSession } from "../../src/server/auth/user";
import { databaseLayer, makeDatabaseService } from "../../src/server/database/service";

const url = process.env.KAIRO_DATABASE_TEST_URL;
const migrationUrl = process.env.KAIRO_DATABASE_MIGRATION_URL;
const run = describe.skipIf(!url || !migrationUrl);

run("production academic workflow", () => {
  const database = makeDatabaseService(url ?? "", { runtimeRole: "kairo_runtime", migrationRole: "kairo_migrator" });
  const layer = Layer.provide(academicServiceLayer, databaseLayer(database));
  const alice = requireUserFromSession({ _tag: "verified", userId: "user_academic_alice", sessionId: "sess_academic_alice" });
  const bob = requireUserFromSession({ _tag: "verified", userId: "user_academic_bob", sessionId: "sess_academic_bob" });
  let direct: ReturnType<typeof postgres>;

  const use = <A>(operation: (service: AcademicService["Service"]) => Effect.Effect<A, unknown>) => Effect.runPromise(AcademicService.use(operation).pipe(Effect.provide(layer)));

  beforeAll(async () => {
    direct = postgres(url ?? "", { max: 1, prepare: false });
    for (const user of [alice, bob]) {
      await direct.begin(async (tx) => {
        await tx`select set_config('app.current_user_id', ${user.id}, true)`;
        await tx`insert into users (id, time_zone) values (${user.id}, 'UTC') on conflict (id) do nothing`;
      });
    }
  });

  afterAll(async () => {
    await direct?.end({ timeout: 5 });
    await Effect.runPromise(database.close());
  });

  it("enforces lifecycle, ownership, idempotency, dependents, and derived deadlines", async () => {
    const course = await use((service) => service.createCourse(alice, { title: "Algorithms", idempotencyKey: "academic-course-create" }));
    expect(course._tag).toBe("applied");
    if (course._tag !== "applied" || !course.value || !("lifecycle" in course.value)) throw new Error("Course setup failed");
    const createdCourse = course.value;

    const repeated = await use((service) => service.createCourse(alice, { title: "Ignored retry payload", idempotencyKey: "academic-course-create" }));
    expect(repeated).toMatchObject({ _tag: "already_applied", value: { id: createdCourse.id } });
    expect(await use((service) => service.getCourse(bob, createdCourse.id))).toBeUndefined();

    const assessment = await use((service) => service.createAssessment(alice, { title: "Midterm", courseId: createdCourse.id, dueDate: "2026-03-10", idempotencyKey: "academic-assessment-create" }));
    if (assessment._tag !== "applied" || !assessment.value || !("status" in assessment.value)) throw new Error("Assessment setup failed");
    const createdAssessment = assessment.value;
    const task = await use((service) => service.createTask(alice, { title: "Review", courseId: createdCourse.id, assessmentId: createdAssessment.id, dueDate: "2026-03-09", idempotencyKey: "academic-task-create" }));
    expect(task._tag).toBe("applied");

    const dependent = await use((service) => service.deleteAssessment(alice, { id: createdAssessment.id, expectedVersion: 1, idempotencyKey: "academic-assessment-delete" }));
    expect(dependent).toMatchObject({ _tag: "conflict", reason: "has_dependents" });

    const deadlines = await use((service) => service.listDeadlines(alice, { q: "", kind: "all", status: "open", courseId: null, from: "2026-03-09", to: "2026-03-15", includeOverdue: true, pageSize: 25, cursor: null }));
    expect(deadlines.items.map(({ kind, title }) => [kind, title])).toEqual([["task", "Review"], ["assessment", "Midterm"]]);

    const archived = await use((service) => service.archiveCourse(alice, { courseId: createdCourse.id, expectedVersion: 1, idempotencyKey: "academic-course-archive" }));
    expect(archived).toMatchObject({ _tag: "applied", value: { lifecycle: "archived", version: 2 } });
    expect(await use((service) => service.courseOptions(alice))).not.toContainEqual(expect.objectContaining({ id: createdCourse.id }));
    const archivedRelation = await use((service) => service.createTask(alice, { title: "Blocked", courseId: createdCourse.id, idempotencyKey: "academic-task-archived-course" }));
    expect(archivedRelation._tag).toBe("not_found");

    const courseDelete = await use((service) => service.deleteCourse(alice, { courseId: createdCourse.id, expectedVersion: 2, idempotencyKey: "academic-course-delete" }));
    expect(courseDelete).toMatchObject({ _tag: "conflict", reason: "has_dependents" });
  });
});
