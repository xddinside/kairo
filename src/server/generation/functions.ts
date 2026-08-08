import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";

import { authenticatedUserMiddleware } from "../auth/middleware";
import type { AuthenticatedUser } from "../auth/user";
import type { GenerationResult } from "./domain";

const executeGeneration = createServerOnlyFn(async (user: AuthenticatedUser, input: unknown): Promise<GenerationResult> => {
  const { runGeneration } = await import("./executor");
  return runGeneration(user, input);
});

/** Generate and persist one validated view for an authenticated User's Canvas. */
export const generateCanvasView = createServerFn({ method: "POST" })
  .middleware([authenticatedUserMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context, data }) => executeGeneration(context.kairoUser, data));
