import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";

import { authenticatedUserMiddleware } from "../auth/middleware";
import type { AuthenticatedUser } from "../auth/user";
import type { TimetableCommandResult } from "./domain";
import type { TimetableList, TimetableListInput } from "./service";

const executeList = createServerOnlyFn(async (user: AuthenticatedUser, input: TimetableListInput): Promise<TimetableList> => {
  const { runTimetableList } = await import("./executor");
  return runTimetableList(user, input);
});

const executeGet = createServerOnlyFn(async (user: AuthenticatedUser, entryId: string, from: string, to: string) => {
  const { runTimetableGet } = await import("./executor");
  return runTimetableGet(user, entryId, from, to);
});

const executeCommand = createServerOnlyFn(async (
  user: AuthenticatedUser,
  operation: "create" | "update" | "skipOccurrence" | "delete" | "undo",
  input: unknown,
): Promise<TimetableCommandResult> => {
  const { runTimetableCommand } = await import("./executor");
  return runTimetableCommand(user, operation, input);
});

/** Read a Timetable collection for the authenticated User. */
export const listTimetable = createServerFn({ method: "GET" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: TimetableListInput) => input)
  .handler(({ context, data }): Promise<TimetableList> => executeList(context.kairoUser as AuthenticatedUser, data));

/** Read one Timetable entry for the authenticated User. */
export const getTimetableEntry = createServerFn({ method: "GET" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: { readonly entryId: string; readonly from: string; readonly to: string }) => input)
  .handler(({ context, data }) => executeGet(context.kairoUser as AuthenticatedUser, data.entryId, data.from, data.to));

/** Create one Timetable entry. */
export const createTimetableEntry = createServerFn({ method: "POST" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context, data }): Promise<TimetableCommandResult> => executeCommand(context.kairoUser as AuthenticatedUser, "create", data));

/** Update one whole Timetable entry. */
export const updateTimetableEntry = createServerFn({ method: "POST" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context, data }): Promise<TimetableCommandResult> => executeCommand(context.kairoUser as AuthenticatedUser, "update", data));

/** Skip one generated weekly occurrence. */
export const skipTimetableOccurrence = createServerFn({ method: "POST" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context, data }): Promise<TimetableCommandResult> => executeCommand(context.kairoUser as AuthenticatedUser, "skipOccurrence", data));

/** Delete one whole Timetable entry. */
export const deleteTimetableEntry = createServerFn({ method: "POST" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context, data }): Promise<TimetableCommandResult> => executeCommand(context.kairoUser as AuthenticatedUser, "delete", data));

/** Consume one Timetable Undo token. */
export const undoTimetableCommand = createServerFn({ method: "POST" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context, data }): Promise<TimetableCommandResult> => executeCommand(context.kairoUser as AuthenticatedUser, "undo", data));
