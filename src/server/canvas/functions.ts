import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";

import { authenticatedUserMiddleware } from "../auth/middleware";
import type { AuthenticatedUser } from "../auth/user";
import type { CanvasDetail, CanvasMutationResult, CanvasSummary, CreateCanvasResult } from "./domain";

const userFromContext = (context: Readonly<{ kairoUser: unknown }>): AuthenticatedUser => {
  if (!context.kairoUser || typeof context.kairoUser !== "object" || !("id" in context.kairoUser) || !("sessionId" in context.kairoUser)) {
    throw new Error("Authenticated User middleware did not supply a User");
  }
  // SAFETY: authenticatedUserMiddleware constructs and owns this context value; browser input cannot populate it.
  return context.kairoUser as AuthenticatedUser;
};

const executeRecent = createServerOnlyFn(async (user: AuthenticatedUser, input: unknown): Promise<ReadonlyArray<CanvasSummary>> => {
  const { runRecentCanvases } = await import("./executor");
  return runRecentCanvases(user, input);
});

const executeSearch = createServerOnlyFn(async (user: AuthenticatedUser, input: unknown): Promise<ReadonlyArray<CanvasSummary>> => {
  const { runSearchCanvases } = await import("./executor");
  return runSearchCanvases(user, input);
});

const executeGet = createServerOnlyFn(async (user: AuthenticatedUser, input: unknown): Promise<CanvasDetail | undefined> => {
  const { runGetCanvas } = await import("./executor");
  return runGetCanvas(user, input);
});

const executeCreate = createServerOnlyFn(async (user: AuthenticatedUser, input: unknown): Promise<CreateCanvasResult> => {
  const { runCreateCanvas } = await import("./executor");
  return runCreateCanvas(user, input);
});

const executeMutation = createServerOnlyFn(async (
  user: AuthenticatedUser,
  operation: "appendActivity" | "appendGeneratedView" | "rename" | "archive" | "restore" | "delete",
  input: unknown,
): Promise<CanvasMutationResult> => {
  const { runCanvasMutation } = await import("./executor");
  return runCanvasMutation(user, operation, input);
});

/** Read recently updated Canvases for the authenticated User. */
export const recentCanvases = createServerFn({ method: "GET" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input)
  .handler(({ context, data }) => executeRecent(userFromContext(context), data));

/** Search the authenticated User's Canvases. */
export const searchCanvases = createServerFn({ method: "GET" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input)
  .handler(({ context, data }) => executeSearch(userFromContext(context), data));

/** Load one Canvas with ordered activity and Generated view history. */
export const getCanvas = createServerFn({ method: "GET" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input)
  .handler(({ context, data }) => executeGet(userFromContext(context), data));

/** Atomically create a Canvas and its first activity. */
export const createCanvas = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input)
  .handler(({ context, data }) => executeCreate(userFromContext(context), data));

/** Append an ordered activity to an active Canvas. */
export const appendCanvasActivity = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input)
  .handler(({ context, data }) => executeMutation(userFromContext(context), "appendActivity", data));
/** Append one immutable validated Generated view. */
export const appendCanvasGeneratedView = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input)
  .handler(({ context, data }) => executeMutation(userFromContext(context), "appendGeneratedView", data));
/** Rename a Canvas with optimistic concurrency. */
export const renameCanvas = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input)
  .handler(({ context, data }) => executeMutation(userFromContext(context), "rename", data));
/** Archive a Canvas with optimistic concurrency. */
export const archiveCanvas = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input)
  .handler(({ context, data }) => executeMutation(userFromContext(context), "archive", data));
/** Restore an archived Canvas with optimistic concurrency. */
export const restoreCanvas = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input)
  .handler(({ context, data }) => executeMutation(userFromContext(context), "restore", data));
/** Soft-delete a Canvas with optimistic concurrency. */
export const deleteCanvas = createServerFn({ method: "POST" }).middleware([authenticatedUserMiddleware]).validator((input: unknown) => input)
  .handler(({ context, data }) => executeMutation(userFromContext(context), "delete", data));
