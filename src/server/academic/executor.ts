import { Effect, Layer } from "effect";

import type { AuthenticatedUser } from "../auth/user";
import { layer as serverConfigLayer } from "../config";
import { liveDatabaseLayer } from "../database/service";
import type { AcademicCommandResult, Assessment, AssessmentOption, Course, CourseOption, DeadlineListInput, Task, TaskListInput } from "./domain";
import { AcademicService, academicServiceLayer } from "./service";

const liveAcademicLayer = Layer.provide(academicServiceLayer, Layer.provide(liveDatabaseLayer, serverConfigLayer));
const run = <A>(effect: Effect.Effect<A, unknown, AcademicService>): Promise<A> => Effect.runPromise(effect.pipe(Effect.provide(liveAcademicLayer)));

/** Course read operations available to the server-function boundary. */
export type CourseReadOperation = "listCourses" | "getCourse" | "courseOptions";
/** Detail and option read operations available to the server-function boundary. */
export type AcademicReadOperation = "getTask" | "getAssessment" | "assessmentOptions";
/** Mutation operations available to the server-function boundary. */
export type AcademicCommandOperation = "createCourse" | "updateCourse" | "archiveCourse" | "reopenCourse" | "deleteCourse" | "createTask" | "updateTask" | "setTaskStatus" | "deleteTask" | "createAssessment" | "updateAssessment" | "setAssessmentStatus" | "deleteAssessment" | "undo";

/** Run a Course read inside the server-only production runtime. */
export const runCourseRead = (user: AuthenticatedUser, operation: CourseReadOperation, input?: string): Promise<ReadonlyArray<Course> | Course | undefined | ReadonlyArray<CourseOption>> => {
  if (operation === "listCourses") return run(AcademicService.use((service) => service.listCourses(user, input === "archived" || input === "all" ? input : "current")));
  if (operation === "getCourse") return run(AcademicService.use((service) => service.getCourse(user, input ?? "")));
  return run(AcademicService.use((service) => service.courseOptions(user)));
};

/** Run a Task or Assessment read inside the server-only production runtime. */
export const runAcademicRead = (user: AuthenticatedUser, operation: AcademicReadOperation, input?: string): Promise<Task | Assessment | undefined | ReadonlyArray<AssessmentOption>> => {
  if (operation === "getTask") return run(AcademicService.use((service) => service.getTask(user, input ?? "")));
  if (operation === "getAssessment") return run(AcademicService.use((service) => service.getAssessment(user, input ?? "")));
  return run(AcademicService.use((service) => service.assessmentOptions(user)));
};

/** Resolve the default seven-day workload range in the authenticated User's timezone. */
export const runWorkloadRange = (user: AuthenticatedUser): Promise<{ readonly from: string; readonly to: string; readonly timeZone: string }> => run(AcademicService.use((service) => service.workloadRange(user)));

/** Run an academic command inside the server-only production runtime. */
export const runAcademicCommand = (user: AuthenticatedUser, operation: AcademicCommandOperation, input: unknown): Promise<AcademicCommandResult<Course | Task | Assessment>> => run(AcademicService.use((service) => {
  switch (operation) {
    case "createCourse": return service.createCourse(user, input);
    case "updateCourse": return service.updateCourse(user, input);
    case "archiveCourse": return service.archiveCourse(user, input);
    case "reopenCourse": return service.reopenCourse(user, input);
    case "deleteCourse": return service.deleteCourse(user, input);
    case "createTask": return service.createTask(user, input);
    case "updateTask": return service.updateTask(user, input);
    case "setTaskStatus": return service.setTaskStatus(user, input);
    case "deleteTask": return service.deleteTask(user, input);
    case "createAssessment": return service.createAssessment(user, input);
    case "updateAssessment": return service.updateAssessment(user, input);
    case "setAssessmentStatus": return service.setAssessmentStatus(user, input);
    case "deleteAssessment": return service.deleteAssessment(user, input);
    case "undo": return service.undo(user, input);
  }
}));

/** Run the owner-scoped Task collection query. */
export const runTaskList = (user: AuthenticatedUser, input: TaskListInput) => run(AcademicService.use((service) => service.listTasks(user, input)));
/** Run the one-snapshot derived Deadline query. */
export const runDeadlineList = (user: AuthenticatedUser, input: DeadlineListInput) => run(AcademicService.use((service) => service.listDeadlines(user, input)));
