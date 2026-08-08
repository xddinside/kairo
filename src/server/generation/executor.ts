import { Effect, Layer } from "effect";

import { academicServiceLayer } from "../academic/service";
import type { AuthenticatedUser } from "../auth/user";
import { canvasServiceLayer } from "../canvas/service";
import { layer as serverConfigLayer } from "../config";
import { liveDatabaseLayer } from "../database/service";
import type { GenerationResult } from "./domain";
import { openCodeGoGatewayLayer } from "./gateway";
import { GenerationService, generationServiceLayer } from "./service";

const infrastructure = Layer.merge(serverConfigLayer, Layer.provide(liveDatabaseLayer, serverConfigLayer));
const dependencies = Layer.provide(
  Layer.mergeAll(canvasServiceLayer, academicServiceLayer, openCodeGoGatewayLayer),
  infrastructure,
);
const liveGenerationLayer = Layer.provide(generationServiceLayer, dependencies);

/** Run a bounded generation in the server-only production runtime. */
export const runGeneration = (user: AuthenticatedUser, input: unknown): Promise<GenerationResult> =>
  Effect.runPromise(GenerationService.use((service) => service.generate(user, input)).pipe(Effect.provide(liveGenerationLayer)));
