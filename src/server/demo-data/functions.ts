import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";

import { authenticatedUserMiddleware } from "../auth/middleware";
import type { AuthenticatedUser } from "../auth/user";
import type { DemoDataResult } from "./service";

const executeSeed = createServerOnlyFn(async (user: AuthenticatedUser): Promise<DemoDataResult> => {
  const { runDemoDataSeed } = await import("./executor");
  return runDemoDataSeed(user);
});

/** Add the fixed idempotent demo dataset to the authenticated User. */
export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([authenticatedUserMiddleware])
  .handler(({ context }) => executeSeed(context.kairoUser));
