import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";

import { authenticatedUserMiddleware } from "../auth/middleware";
import type { AuthenticatedUser } from "../auth/user";
import type { NoteCommandResult, NoteCourseOption } from "./domain";
import type { NoteList, NoteListInput } from "./service";

const userFromContext = (context: Readonly<{ kairoUser: unknown }>): AuthenticatedUser => {
  if (!context.kairoUser || typeof context.kairoUser !== "object" || !("id" in context.kairoUser) || !("sessionId" in context.kairoUser)) throw new Error("Authenticated User middleware did not supply a User");
  // SAFETY: authenticatedUserMiddleware constructs and owns this context value; browser input cannot populate it.
  return context.kairoUser as AuthenticatedUser;
};

const executeList = createServerOnlyFn(async (user: AuthenticatedUser, input: NoteListInput): Promise<NoteList> => (await import("./executor")).runListNotes(user, input));
const executeGet = createServerOnlyFn(async (user: AuthenticatedUser, noteId: string) => (await import("./executor")).runGetNote(user, noteId));
const executeCourses = createServerOnlyFn(async (user: AuthenticatedUser): Promise<ReadonlyArray<NoteCourseOption>> => (await import("./executor")).runListNoteCourses(user));
const executeCommand = createServerOnlyFn(async (user: AuthenticatedUser, operation: "create" | "update" | "delete" | "undo", input: unknown): Promise<NoteCommandResult> => (await import("./executor")).runNoteCommand(user, operation, input));

/** Read a Notes collection for the authenticated User. */
export const listNotes = createServerFn({ method: "GET" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: NoteListInput) => input)
  .handler(({ context, data }): Promise<NoteList> => executeList(userFromContext(context), data));

/** Read one Note for the authenticated User. */
export const getNote = createServerFn({ method: "GET" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: { readonly noteId: string }) => input)
  .handler(({ context, data }) => executeGet(userFromContext(context), data.noteId));

/** Read current owner-scoped Course options for Note forms. */
export const listNoteCourses = createServerFn({ method: "GET" })
  .middleware([authenticatedUserMiddleware])
  .handler(({ context }): Promise<ReadonlyArray<NoteCourseOption>> => executeCourses(userFromContext(context)));

/** Create one Note. */
export const createNote = createServerFn({ method: "POST" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context, data }): Promise<NoteCommandResult> => executeCommand(userFromContext(context), "create", data));

/** Update one Note. */
export const updateNote = createServerFn({ method: "POST" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context, data }): Promise<NoteCommandResult> => executeCommand(userFromContext(context), "update", data));

/** Delete one Note. */
export const deleteNote = createServerFn({ method: "POST" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context, data }): Promise<NoteCommandResult> => executeCommand(userFromContext(context), "delete", data));

/** Consume one Note Undo token. */
export const undoNoteCommand = createServerFn({ method: "POST" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context, data }): Promise<NoteCommandResult> => executeCommand(userFromContext(context), "undo", data));
