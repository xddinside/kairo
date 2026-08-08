import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import postgres from "postgres";

import { requireUserFromSession } from "../../src/server/auth/user";
import { databaseLayer, makeDatabaseService } from "../../src/server/database/service";
import { TimetableService, timetableServiceLayer } from "../../src/server/timetable/service";

const url = process.env.KAIRO_DATABASE_TEST_URL;
const migrationUrl = process.env.KAIRO_DATABASE_MIGRATION_URL;
const run = describe.skipIf(!url || !migrationUrl);

run("production Timetable workflow", () => {
  const database = makeDatabaseService(url ?? "", { runtimeRole: "kairo_runtime", migrationRole: "kairo_migrator" });
  const layer = Layer.provide(timetableServiceLayer, databaseLayer(database));
  const alice = requireUserFromSession({ _tag: "verified", userId: "user_timetable_alice", sessionId: "sess_timetable_alice" });
  const bob = requireUserFromSession({ _tag: "verified", userId: "user_timetable_bob", sessionId: "sess_timetable_bob" });
  let direct: ReturnType<typeof postgres>;

  const use = <A>(operation: (service: TimetableService["Service"]) => Effect.Effect<A, unknown>) =>
    Effect.runPromise(TimetableService.use(operation).pipe(Effect.provide(layer)));

  beforeAll(async () => {
    direct = postgres(url ?? "", { max: 1, prepare: false });
    for (const user of [alice, bob]) {
      await direct.begin(async (tx) => {
        await tx`select set_config('app.current_user_id', ${user.id}, true)`;
        await tx`insert into users (id, time_zone) values (${user.id}, 'America/New_York') on conflict (id) do nothing`;
      });
    }
  });

  afterAll(async () => {
    await direct?.end({ timeout: 5 });
    await Effect.runPromise(database.close());
  });

  it("persists one recurring entry, warns on overlap, skips one date, and isolates Users", async () => {
    const first = await use((service) => service.create(alice, {
      title: "Algorithms",
      kind: "weekly",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      daysOfWeek: [1],
      startTime: "09:00",
      endTime: "10:00",
      idempotencyKey: "timetable-create-one",
    }));
    expect(first._tag).toBe("applied");
    if (first._tag !== "applied" || !first.value) throw new Error("Timetable setup failed");
    const createdEntry = first.value;

    const retry = await use((service) => service.create(alice, {
      title: "Algorithms",
      kind: "weekly",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      daysOfWeek: [1],
      startTime: "09:00",
      endTime: "10:00",
      idempotencyKey: "timetable-create-one",
    }));
    expect(retry).toMatchObject({ _tag: "already_applied", value: { id: createdEntry.id } });

    const overlapping = await use((service) => service.create(alice, {
      title: "Study group",
      kind: "one_off",
      startDate: "2026-03-02",
      endDate: "2026-03-02",
      daysOfWeek: [],
      startTime: "09:30",
      endTime: "10:30",
      idempotencyKey: "timetable-overlap",
    }));
    expect(overlapping).toMatchObject({ _tag: "applied", overlapWarnings: [{ entryId: createdEntry.id, date: "2026-03-02" }] });

    const foreign = await use((service) => service.get(bob, createdEntry.id, "2026-03-01", "2026-03-31"));
    expect(foreign).toBeUndefined();

    const skipped = await use((service) => service.skipOccurrence(alice, {
      entryId: createdEntry.id,
      occurrenceDate: "2026-03-09",
      expectedVersion: 1,
      idempotencyKey: "timetable-skip",
    }));
    expect(skipped).toMatchObject({ _tag: "applied", value: { version: 2, exceptions: ["2026-03-09"] } });
    if (skipped._tag !== "applied" || !skipped.undoToken) throw new Error("Skip did not return Undo");

    const stale = await use((service) => service.skipOccurrence(alice, {
      entryId: createdEntry.id,
      occurrenceDate: "2026-03-16",
      expectedVersion: 1,
      idempotencyKey: "timetable-stale-skip",
    }));
    expect(stale).toMatchObject({ _tag: "conflict", current: { version: 2 } });

    const undone = await use((service) => service.undo(alice, { token: skipped.undoToken, idempotencyKey: "timetable-undo-skip" }));
    expect(undone._tag).toBe("applied");
    const restored = await use((service) => service.get(alice, createdEntry.id, "2026-03-01", "2026-03-31"));
    expect(restored?.exceptions).toEqual([]);
    expect(restored?.occurrences.map(({ date }) => date)).toContain("2026-03-09");
  }, 20_000);
});
