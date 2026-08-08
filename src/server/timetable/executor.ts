import { Effect, Layer } from "effect";

import type { AuthenticatedUser } from "../auth/user";
import { layer as serverConfigLayer } from "../config";
import { liveDatabaseLayer } from "../database/service";
import type { TimetableCommandResult } from "./domain";
import { TimetableService, timetableServiceLayer, type TimetableList, type TimetableListInput } from "./service";

const liveTimetableLayer = Layer.provide(timetableServiceLayer, Layer.provide(liveDatabaseLayer, serverConfigLayer));

const run = <A>(effect: Effect.Effect<A, unknown, TimetableService>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(liveTimetableLayer)));

/** Run a server-only Timetable read. */
export const runTimetableList = (user: AuthenticatedUser, input: TimetableListInput): Promise<TimetableList> =>
  run(TimetableService.use((service) => service.list(user, input)));

/** Run a server-only Timetable detail read. */
export const runTimetableGet = (user: AuthenticatedUser, entryId: string, from: string, to: string): Promise<import("./domain").TimetableEntry | undefined> =>
  run(TimetableService.use((service) => service.get(user, entryId, from, to)));

/** Run a server-only Timetable command. */
export const runTimetableCommand = (
  user: AuthenticatedUser,
  operation: "create" | "update" | "skipOccurrence" | "delete" | "undo",
  input: unknown,
): Promise<TimetableCommandResult> => run(TimetableService.use((service) => service[operation](user, input)));
