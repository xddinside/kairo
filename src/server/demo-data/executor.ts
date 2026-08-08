import { Effect, Layer } from "effect";

import { academicServiceLayer } from "../academic/service";
import type { AuthenticatedUser } from "../auth/user";
import { layer as serverConfigLayer } from "../config";
import { liveDatabaseLayer } from "../database/service";
import { DemoDataService, demoDataServiceLayer, type DemoDataResult } from "./service";

const databaseLayer = Layer.provide(liveDatabaseLayer, serverConfigLayer);
const liveLayer = Layer.provide(demoDataServiceLayer, Layer.provide(academicServiceLayer, databaseLayer));

/** Seed demo data in the server-only production runtime. */
export const runDemoDataSeed = (user: AuthenticatedUser): Promise<DemoDataResult> =>
  Effect.runPromise(DemoDataService.use((service) => service.seed(user)).pipe(Effect.provide(liveLayer)));
