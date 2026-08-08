import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";

import { authenticatedUserMiddleware } from "../auth/middleware";
import type { AuthenticatedUser } from "../auth/user";
import type { AcademicCommandResult, Assessment, AssessmentOption, Course, CourseOption, DeadlineListInput, DeadlinePage, Task, TaskListInput, TaskPage } from "./domain";
import type { AcademicCommandOperation, AcademicReadOperation, CourseReadOperation } from "./executor";

const executeCourseRead = createServerOnlyFn(async (user: AuthenticatedUser, operation: CourseReadOperation, input?: string): Promise<ReadonlyArray<Course> | Course | undefined | ReadonlyArray<CourseOption>> => { const { runCourseRead } = await import("./executor"); return runCourseRead(user, operation, input); });
const executeAcademicRead = createServerOnlyFn(async (user: AuthenticatedUser, operation: AcademicReadOperation, input?: string): Promise<Task | Assessment | undefined | ReadonlyArray<AssessmentOption>> => { const { runAcademicRead } = await import("./executor"); return runAcademicRead(user, operation, input); });
const executeCommand = createServerOnlyFn(async (user: AuthenticatedUser, operation: AcademicCommandOperation, input: unknown): Promise<AcademicCommandResult<Course | Task | Assessment>> => { const { runAcademicCommand } = await import("./executor"); return runAcademicCommand(user, operation, input); });
const executeTasks = createServerOnlyFn(async (user: AuthenticatedUser, input: TaskListInput): Promise<TaskPage> => { const { runTaskList } = await import("./executor"); return runTaskList(user, input); });
const executeDeadlines = createServerOnlyFn(async (user: AuthenticatedUser, input: DeadlineListInput): Promise<DeadlinePage> => { const { runDeadlineList } = await import("./executor"); return runDeadlineList(user, input); });
const executeWorkloadRange = createServerOnlyFn(async (user: AuthenticatedUser): Promise<{ readonly from: string; readonly to: string; readonly timeZone: string }> => { const { runWorkloadRange } = await import("./executor"); return runWorkloadRange(user); });

/** List owner-scoped Courses. */
export const listCourses = createServerFn({ method: "GET" }).middleware([authenticatedUserMiddleware]).validator((input: "current" | "archived" | "all") => input).handler(({ context, data }) => executeCourseRead(context.kairoUser, "listCourses", data));
/** Get one owner-scoped Course. */
export const getCourse = createServerFn({ method: "GET" }).middleware([authenticatedUserMiddleware]).validator((input: string) => input).handler(({ context, data }) => executeCourseRead(context.kairoUser, "getCourse", data));
/** List current Course options. */
export const listCourseOptions = createServerFn({ method: "GET" }).middleware([authenticatedUserMiddleware]).handler(({ context }) => executeCourseRead(context.kairoUser, "courseOptions"));
/** List owner-scoped Tasks with stable cursor paging. */
export const listTasks = createServerFn({ method: "GET" }).middleware([authenticatedUserMiddleware]).validator((input: TaskListInput) => input).handler(({ context, data }) => executeTasks(context.kairoUser, data));
/** Get one owner-scoped Task. */
export const getTask = createServerFn({ method: "GET" }).middleware([authenticatedUserMiddleware]).validator((input: string) => input).handler(({ context, data }) => executeAcademicRead(context.kairoUser, "getTask", data));
/** Get one owner-scoped Assessment. */
export const getAssessment = createServerFn({ method: "GET" }).middleware([authenticatedUserMiddleware]).validator((input: string) => input).handler(({ context, data }) => executeAcademicRead(context.kairoUser, "getAssessment", data));
/** List current Assessment options. */
export const listAssessmentOptions = createServerFn({ method: "GET" }).middleware([authenticatedUserMiddleware]).handler(({ context }) => executeAcademicRead(context.kairoUser, "assessmentOptions"));
/** List the one-snapshot derived Deadline union. */
export const listDeadlines = createServerFn({ method: "GET" }).middleware([authenticatedUserMiddleware]).validator((input: DeadlineListInput) => input).handler(({ context, data }) => executeDeadlines(context.kairoUser, data));
/** Resolve the default workload range from the authenticated User's timezone. */
export const getAcademicWorkloadRange = createServerFn({ method: "GET" }).middleware([authenticatedUserMiddleware]).handler(({ context }) => executeWorkloadRange(context.kairoUser));

/** Create a Course. */
export const createCourse = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "createCourse", data));
/** Update a Course. */
export const updateCourse = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "updateCourse", data));
/** Archive a Course. */
export const archiveCourse = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "archiveCourse", data));
/** Reopen an archived Course. */
export const reopenCourse = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "reopenCourse", data));
/** Delete a Course without live dependents. */
export const deleteCourse = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "deleteCourse", data));
/** Create a Task. */
export const createTask = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "createTask", data));
/** Update a Task. */
export const updateTask = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "updateTask", data));
/** Change a Task status. */
export const setTaskStatus = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "setTaskStatus", data));
/** Delete a Task. */
export const deleteTask = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "deleteTask", data));
/** Create an Assessment. */
export const createAssessment = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "createAssessment", data));
/** Update an Assessment. */
export const updateAssessment = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "updateAssessment", data));
/** Change an Assessment status. */
export const setAssessmentStatus = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "setAssessmentStatus", data));
/** Delete an Assessment when no live Task links to it. */
export const deleteAssessment = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "deleteAssessment", data));
/** Consume one recent academic Undo token. */
export const undoAcademicCommand = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input).handler(({ context, data }) => executeCommand(context.kairoUser, "undo", data));
