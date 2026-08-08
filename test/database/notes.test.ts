import { Effect, Layer } from "effect";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { requireUserFromSession } from "../../src/server/auth/user";
import { databaseLayer, makeDatabaseService } from "../../src/server/database/service";
import { NoteService, noteServiceLayer, type NoteServiceShape } from "../../src/server/notes/service";

const url = process.env.KAIRO_DATABASE_TEST_URL;
const migrationUrl = process.env.KAIRO_DATABASE_MIGRATION_URL;
const run = describe.skipIf(!url || !migrationUrl);

let db: ReturnType<typeof postgres>;

run("production Note service", () => {
  beforeAll(async () => {
    db = postgres(url!, { max: 2, prepare: false });
    for (const userId of ["user_notes_alice", "user_notes_bob"]) {
      await db.begin(async (tx) => {
        await tx`select set_config('app.current_user_id', ${userId}, true)`;
        await tx`insert into users (id, time_zone) values (${userId}, 'UTC') on conflict (id) do nothing`;
      });
    }
  });

  afterAll(async () => { await db?.end({ timeout: 5 }); });

  it("persists owner-scoped Notes with idempotency, conflicts, search, deletion, and one-use Undo", async () => {
    const database = makeDatabaseService(url!, { runtimeRole: "kairo_runtime", migrationRole: "kairo_migrator" });
    const layer = Layer.provide(noteServiceLayer, databaseLayer(database));
    const alice = requireUserFromSession({ _tag: "verified", userId: "user_notes_alice", sessionId: "sess_notes_alice" });
    const bob = requireUserFromSession({ _tag: "verified", userId: "user_notes_bob", sessionId: "sess_notes_bob" });
    const use = <A>(effect: (service: NoteServiceShape) => Effect.Effect<A, unknown>) => Effect.runPromise(NoteService.use(effect).pipe(Effect.provide(layer)));

    const created = await use((service) => service.create(alice, { title: "Research", bodyMarkdown: "one\r\ntwo", idempotencyKey: "notes-create" }));
    expect(created._tag).toBe("applied");
    if (created._tag !== "applied" || !created.value || !created.undoToken) throw new Error("Note create setup failed");
    expect(created.value.bodyMarkdown).toBe("one\ntwo");
    const noteId = created.value.id;
    expect(await use((service) => service.create(alice, { title: "Research", bodyMarkdown: "one\r\ntwo", idempotencyKey: "notes-create" }))).toMatchObject({ _tag: "already_applied", value: { id: noteId } });
    expect(await use((service) => service.get(bob, noteId))).toBeUndefined();

    const listed = await use((service) => service.list(alice, { q: "research", courseId: null, sort: "updated_desc", pageSize: 25, cursor: null }));
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toMatchObject({ id: noteId, preview: "one two" });

    const edited = await use((service) => service.update(alice, { noteId, expectedVersion: 1, title: "Research notes", bodyMarkdown: "updated", courseId: null, idempotencyKey: "notes-edit" }));
    expect(edited).toMatchObject({ _tag: "applied", value: { version: 2 } });
    expect(await use((service) => service.update(alice, { noteId, expectedVersion: 1, title: "stale", bodyMarkdown: "stale", courseId: null, idempotencyKey: "notes-stale" }))).toMatchObject({ _tag: "conflict", current: { title: "Research notes" } });
    expect(await use((service) => service.update(bob, { noteId, expectedVersion: 2, title: "foreign", bodyMarkdown: "foreign", courseId: null, idempotencyKey: "notes-foreign" }))).toEqual({ _tag: "not_found" });

    const deleted = await use((service) => service.delete(alice, { noteId, expectedVersion: 2, idempotencyKey: "notes-delete" }));
    expect(deleted._tag).toBe("applied");
    if (deleted._tag !== "applied" || !deleted.undoToken) throw new Error("Note delete setup failed");
    expect(await use((service) => service.get(alice, noteId))).toBeUndefined();
    expect(await use((service) => service.undo(alice, { token: deleted.undoToken, idempotencyKey: "notes-undo" }))).toMatchObject({ _tag: "applied" });
    expect(await use((service) => service.undo(alice, { token: deleted.undoToken, idempotencyKey: "notes-undo-reused" }))).toMatchObject({ _tag: "conflict" });
    expect(await use((service) => service.get(alice, noteId))).toMatchObject({ title: "Research notes", bodyMarkdown: "updated" });
    await Effect.runPromise(database.close());
  });
});

if (!url || !migrationUrl) console.log("SKIP Note database tests: embedded harness or isolated URLs are required");
