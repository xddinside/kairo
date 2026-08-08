import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Context, Effect, Layer, Schema } from "effect";

import type { AuthenticatedUser } from "../auth/user";
import type { DatabaseUnavailable, UnsafeDatabaseExecution } from "../database/service";
import { CommandEnvelope, type Assessment, type CommandEnvelope as Envelope, type CommandResult, type Task } from "./schema";

export class CommandInvalid extends Schema.TaggedError<CommandInvalid>()("Kairo.CommandInvalid", { fields: Schema.Array(Schema.Struct({ field: Schema.String, message: Schema.String })) }) {}
export class CommandUnavailable extends Schema.TaggedError<CommandUnavailable>()("Kairo.CommandUnavailable", { requestId: Schema.String }) {}

type StoredCommand = { readonly result: CommandResult; readonly id: string };
type UndoRecord = { ownerId: string; tokenHash: string; expiresAt: number; expectedVersion: number; inverse: () => void; consumed: boolean };

export interface DomainStore {
  readonly transact: <A>(operation: (store: MutableDomainStore) => A) => Effect.Effect<A, CommandUnavailable>;
}

export interface MutableDomainStore {
  commands: Map<string, StoredCommand>;
  tasks: Map<string, Task>;
  assessments: Map<string, Assessment>;
  undos: Map<string, UndoRecord>;
}

const cloneState = (source: MutableDomainStore): MutableDomainStore => ({ commands: new Map(source.commands), tasks: new Map(source.tasks), assessments: new Map(source.assessments), undos: new Map([...source.undos].map(([key, value]) => [key, { ...value }])) });

export class MemoryDomainStore implements DomainStore {
  readonly state: MutableDomainStore = { commands: new Map(), tasks: new Map(), assessments: new Map(), undos: new Map() };
  transact = <A>(operation: (store: MutableDomainStore) => A): Effect.Effect<A, CommandUnavailable> => Effect.sync(() => { const working = cloneState(this.state); const result = operation(working); this.state.commands = working.commands; this.state.tasks = working.tasks; this.state.assessments = working.assessments; this.state.undos = working.undos; return result; });
}

export interface DomainCommandService {
  readonly execute: (user: AuthenticatedUser, input: unknown) => Effect.Effect<CommandResult, CommandInvalid | CommandUnavailable | DatabaseUnavailable | UnsafeDatabaseExecution>;
}
export class DomainCommands extends Context.Service<DomainCommands, DomainCommandService>()("kairo/server/DomainCommands") {}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const now = () => new Date();
const validTransition = (from: Task["status"], to: Task["status"]) => from === to || from === "open" || to === "open";
const invalid = (fields: Array<{ field: string; message: string }>): CommandResult => ({ _tag: "invalid", fields });

const makeUndo = (store: MutableDomainStore, userId: string, expectedVersion: number, inverse: () => void) => {
  const token = randomBytes(32).toString("base64url");
  store.undos.set(hashToken(token), { ownerId: userId, tokenHash: hashToken(token), expectedVersion, expiresAt: Date.now() + 30_000, inverse, consumed: false });
  return token;
};

const execute = (store: MutableDomainStore, user: AuthenticatedUser, envelope: Envelope): CommandResult => {
  const prior = store.commands.get(`${user.id}:${envelope.idempotencyKey}`);
  if (prior) return "value" in prior.result ? { ...prior.result, _tag: "already_applied" } : prior.result;
  const save = (result: CommandResult) => { store.commands.set(`${user.id}:${envelope.idempotencyKey}`, { id: randomUUID(), result }); return result; };
  const args = envelope.args as Record<string, unknown>;
  if (envelope.kind === "undo") {
    const token = String(args.token);
    const undo = store.undos.get(hashToken(token));
    if (!undo || undo.ownerId !== user.id || undo.consumed || undo.expiresAt <= Date.now()) return save({ _tag: "conflict", reason: "unsafe_undo" });
    undo.inverse(); undo.consumed = true; return save({ _tag: "applied", value: null });
  }
  if (envelope.kind === "task.create") {
    const titleValue = String(args.title ?? "").trim();
    if (!titleValue || titleValue.length > 200) return save(invalid([{ field: "title", message: "Title must be 1-200 characters" }]));
    const created: Task = { id: randomUUID(), ownerId: user.id, title: titleValue, details: (args.details as string | null | undefined) ?? null, courseId: (args.courseId as string | null | undefined) ?? null, assessmentId: (args.assessmentId as string | null | undefined) ?? null, dueDate: (args.dueDate as string | null | undefined) ?? null, dueTime: (args.dueTime as string | null | undefined) ?? null, status: "open", version: 1, createdAt: now(), updatedAt: now(), deletedAt: null };
    if (created.dueTime && !created.dueDate) return save(invalid([{ field: "dueTime", message: "A due time requires a due date" }]));
    store.tasks.set(created.id, created);
    const undoToken = makeUndo(store, user.id, 1, () => store.tasks.delete(created.id));
    return save({ _tag: "applied", value: created, undoToken });
  }
  const record = args.record as { kind: "task" | "assessment"; id: string } | undefined;
  const id = envelope.kind === "task.update" ? String(args.taskId) : record?.id;
  const collection = record?.kind === "assessment" ? store.assessments : store.tasks;
  const current = id ? collection.get(id) : undefined;
  if (!current || current.ownerId !== user.id || current.deletedAt) return save({ _tag: "not_found" });
  const expected = Number(args.expectedVersion);
  if (!Number.isInteger(expected) || current.version !== expected) return save({ _tag: "conflict", reason: "stale_version", current });
  if (envelope.kind === "academic.delete" && record?.kind === "assessment" && [...store.tasks.values()].some((task) => task.assessmentId === current.id && !task.deletedAt)) return save({ _tag: "conflict", reason: "has_dependents", current });
  const previous = current;
  let next: Task = current;
  if (envelope.kind === "task.update") {
    const patch = (args.patch ?? {}) as Record<string, unknown>;
    next = { ...current, ...(patch.title === undefined ? {} : { title: String(patch.title).trim() }), ...(patch.details === undefined ? {} : { details: patch.details as string | null }), ...(patch.courseId === undefined ? {} : { courseId: patch.courseId as string | null }), ...(patch.assessmentId === undefined ? {} : { assessmentId: patch.assessmentId as string | null }), ...(patch.dueDate === undefined ? {} : { dueDate: patch.dueDate as string | null }), ...(patch.dueTime === undefined ? {} : { dueTime: patch.dueTime as string | null }), version: current.version + 1, updatedAt: now() };
    if (!next.title) return save(invalid([{ field: "title", message: "Title is required" }]));
  } else if (envelope.kind === "academic.status") {
    const status = args.status as Task["status"];
    if (!validTransition(current.status, status) || (current.status !== "open" && status !== "open")) return save(invalid([{ field: "status", message: "Complete and cancelled are not directly interchangeable" }]));
    next = { ...current, status, version: current.version + 1, updatedAt: now() };
  } else if (envelope.kind === "academic.delete") {
    next = { ...current, deletedAt: now(), version: current.version + 1, updatedAt: now() };
  }
  collection.set(current.id, next);
  const undoToken = makeUndo(store, user.id, next.version, () => collection.set(current.id, previous));
  return save({ _tag: "applied", value: next, undoToken });
};

export const makeDomainCommandService = (store: DomainStore): DomainCommandService => ({
  execute: (user, input) => Effect.gen(function* () {
    const envelope = yield* Schema.decodeUnknownEffect(CommandEnvelope)(input).pipe(Effect.mapError((error) => new CommandInvalid({ fields: [{ field: "command", message: String(error) }] })));
    return yield* store.transact((state) => execute(state, user, envelope));
  }),
});

export const domainCommandsLayer = (store: DomainStore): Layer.Layer<DomainCommands> => Layer.succeed(DomainCommands, makeDomainCommandService(store));
