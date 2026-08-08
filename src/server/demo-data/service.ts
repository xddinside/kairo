import { Context, Effect, Layer } from "effect";

import { AcademicService } from "../academic/service";
import type { AcademicCommandResult, Assessment, Course, Task } from "../academic/domain";
import type { AuthenticatedUser } from "../auth/user";

/** Summary of demo records available after seeding. */
export interface DemoDataResult {
  readonly courses: number;
  readonly assessments: number;
  readonly tasks: number;
}

/** Application service for adding the fixed hackathon dataset to one authenticated User. */
export interface DemoDataServiceShape {
  readonly seed: (user: AuthenticatedUser) => Effect.Effect<DemoDataResult, unknown>;
}

/** Demo data service tag. */
export class DemoDataService extends Context.Service<DemoDataService, DemoDataServiceShape>()("kairo/server/DemoDataService") {}

const today = (): string => new Date().toISOString().slice(0, 10);
const plusDays = (value: string, days: number): string => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const requireCourse = (result: AcademicCommandResult<Course | Task | Assessment>): Course => {
  if ((result._tag !== "applied" && result._tag !== "already_applied") || !result.value || !("lifecycle" in result.value)) throw new Error("Demo Course could not be seeded");
  return result.value;
};

const requireAssessment = (result: AcademicCommandResult<Course | Task | Assessment>): Assessment => {
  if ((result._tag !== "applied" && result._tag !== "already_applied") || !result.value || !("status" in result.value) || !("courseTitle" in result.value) || "assessmentId" in result.value) throw new Error("Demo Assessment could not be seeded");
  return result.value;
};

/** Build the demo seed operation from the existing academic service. */
export const demoDataServiceLayer = Layer.effect(DemoDataService, Effect.gen(function* () {
  const academic = yield* AcademicService;
  const seed = Effect.fn("DemoData.seed")((user: AuthenticatedUser) => Effect.gen(function* () {
    const date = today();
    const courseInputs = [
      { key: "ainn", title: "AI & Neural Networks", code: "CS401" },
      { key: "toc", title: "Theory of Computation", code: "CS302" },
      { key: "se", title: "Software Engineering", code: "CS305" },
      { key: "eh", title: "Ethical Hacking", code: "CS418" },
    ] as const;
    const courses = new Map<string, Course>();
    for (const input of courseInputs) {
      const result = yield* academic.createCourse(user, { title: input.title, code: input.code, idempotencyKey: `demo-v1:course:${input.key}` });
      courses.set(input.key, requireCourse(result));
    }

    const assessmentResult = yield* academic.createAssessment(user, {
      title: "AINN Quiz 2",
      courseId: courses.get("ainn")?.id,
      dueDate: plusDays(date, 2),
      dueTime: "09:00",
      idempotencyKey: "demo-v1:assessment:ainn-quiz-2",
    });
    const assessment = requireAssessment(assessmentResult);
    const tasks: ReadonlyArray<{ readonly key: string; readonly title: string; readonly courseId?: string; readonly assessmentId?: string; readonly dueDate: string; readonly dueTime?: string; readonly details?: string }> = [
      { key: "backprop", title: "Review backpropagation examples", courseId: courses.get("ainn")?.id, assessmentId: assessment.id, dueDate: plusDays(date, 1), dueTime: "20:00" },
      { key: "toc-tutorial", title: "Finish TOC Tutorial 3", courseId: courses.get("toc")?.id, dueDate: plusDays(date, -1), details: "Questions 4-5 left" },
      { key: "planning-flow", title: "Finish the planning flow", courseId: courses.get("se")?.id, dueDate: plusDays(date, 3), dueTime: "18:00" },
      { key: "vm-exercise", title: "Complete the vulnerable-VM exercise", courseId: courses.get("eh")?.id, dueDate: plusDays(date, 7), dueTime: "17:00" },
      { key: "practice-quiz", title: "Take an AINN practice quiz", courseId: courses.get("ainn")?.id, assessmentId: assessment.id, dueDate: plusDays(date, 2) },
      { key: "toc-notes", title: "Summarize pumping lemma mistakes", courseId: courses.get("toc")?.id, dueDate: plusDays(date, 4) },
    ] as const;
    for (const task of tasks) {
      yield* academic.createTask(user, {
        title: task.title,
        courseId: task.courseId,
        ...(task.assessmentId ? { assessmentId: task.assessmentId } : {}),
        dueDate: task.dueDate,
        ...(task.dueTime ? { dueTime: task.dueTime } : {}),
        ...(task.details ? { details: task.details } : {}),
        idempotencyKey: `demo-v1:task:${task.key}`,
      });
    }
    return { courses: courseInputs.length, assessments: 1, tasks: tasks.length };
  }));
  return DemoDataService.of({ seed });
}));
