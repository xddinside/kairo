import { Effect, Layer } from "effect";

import type { AuthenticatedUser } from "../auth/user";
import { layer as serverConfigLayer } from "../config";
import { liveDatabaseLayer } from "../database/service";
import type { CanvasDetail, CanvasMutationResult, CanvasSummary, CreateCanvasResult } from "./domain";
import { CanvasService, canvasServiceLayer } from "./service";

const liveCanvasLayer = Layer.provide(canvasServiceLayer, Layer.provide(liveDatabaseLayer, serverConfigLayer));
const run = <A>(effect: Effect.Effect<A, unknown, CanvasService>): Promise<A> => Effect.runPromise(effect.pipe(Effect.provide(liveCanvasLayer)));

/** Run the owner-scoped recent Canvas query. */
export const runRecentCanvases = (user: AuthenticatedUser, input: unknown): Promise<ReadonlyArray<CanvasSummary>> =>
  run(CanvasService.use((service) => service.recent(user, input)));

/** Run the owner-scoped Canvas search query. */
export const runSearchCanvases = (user: AuthenticatedUser, input: unknown): Promise<ReadonlyArray<CanvasSummary>> =>
  run(CanvasService.use((service) => service.search(user, input)));

/** Load one owner-scoped Canvas and its ordered history. */
export const runGetCanvas = (user: AuthenticatedUser, input: unknown): Promise<CanvasDetail | undefined> =>
  run(CanvasService.use((service) => service.get(user, input)));

/** Atomically create a Canvas and its first activity. */
export const runCreateCanvas = (user: AuthenticatedUser, input: unknown): Promise<CreateCanvasResult> =>
  run(CanvasService.use((service) => service.create(user, input)));

/** Run a Canvas mutation. */
export const runCanvasMutation = (
  user: AuthenticatedUser,
  operation: "appendActivity" | "appendGeneratedView" | "rename" | "archive" | "restore" | "delete",
  input: unknown,
): Promise<CanvasMutationResult> => run(CanvasService.use((service) => service[operation](user, input)));
