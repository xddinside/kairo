import { Effect, Layer } from "effect";

import type { AuthenticatedUser } from "../auth/user";
import { layer as serverConfigLayer } from "../config";
import { liveDatabaseLayer } from "../database/service";
import type { NoteCommandResult, NoteCourseOption } from "./domain";
import { NoteService, noteServiceLayer, type NoteList, type NoteListInput } from "./service";

const liveNoteLayer = Layer.provide(noteServiceLayer, Layer.provide(liveDatabaseLayer, serverConfigLayer));
const run = <A>(effect: Effect.Effect<A, unknown, NoteService>): Promise<A> => Effect.runPromise(effect.pipe(Effect.provide(liveNoteLayer)));

/** Execute an owner-scoped Notes collection read on the server. */
export const runListNotes = (user: AuthenticatedUser, input: NoteListInput): Promise<NoteList> => run(NoteService.use((service) => service.list(user, input)));

/** Execute an owner-scoped Note detail read on the server. */
export const runGetNote = (user: AuthenticatedUser, noteId: string) => run(NoteService.use((service) => service.get(user, noteId)));

/** Execute an owner-scoped current Course lookup on the server. */
export const runListNoteCourses = (user: AuthenticatedUser): Promise<ReadonlyArray<NoteCourseOption>> => run(NoteService.use((service) => service.courses(user)));

/** Execute one Note Domain command on the server. */
export const runNoteCommand = (user: AuthenticatedUser, operation: "create" | "update" | "delete" | "undo", input: unknown): Promise<NoteCommandResult> => run(NoteService.use((service) => service[operation](user, input)));
