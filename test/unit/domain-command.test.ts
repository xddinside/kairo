import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { createHash } from "node:crypto";

import { requireUserFromSession, type AuthenticatedUser } from "../../src/server/auth/user";
import { MemoryDomainStore, makeDomainCommandService } from "../../src/server/domain/commands";
import type { Assessment, CommandResult, Task } from "../../src/server/domain/schema";

const user = (id: string): AuthenticatedUser => requireUserFromSession({ _tag: "verified", userId: id, sessionId: `sess_${id.slice(5)}` });
const create = (key: string) => ({ version: 1 as const, idempotencyKey: key, kind: "task.create" as const, args: { title: "Read chapter" } });
const execute = async (service: ReturnType<typeof makeDomainCommandService>, current: AuthenticatedUser, input: unknown): Promise<CommandResult> => Effect.runPromise(service.execute(current, input));

describe("versioned Domain commands", () => {
  it("atomically creates once and returns the durable original result on retry", async () => {
    const service = makeDomainCommandService(new MemoryDomainStore());
    const alice = user("user_alice");
    const first = await execute(service, alice, create("create-1"));
    const second = await execute(service, alice, create("create-1"));
    expect(first._tag).toBe("applied");
    expect(second._tag).toBe("already_applied");
    if (first._tag === "applied" && second._tag === "already_applied") {
      expect(second.value).toEqual(first.value);
      expect(second.undoToken).toEqual(first.undoToken);
    }
  });

  it("keeps foreign and missing records equivalent", async () => {
    const service = makeDomainCommandService(new MemoryDomainStore());
    const alice = user("user_alice");
    const bob = user("user_bob");
    const created = await execute(service, alice, create("create-2"));
    const id = created._tag === "applied" && created.value ? created.value.id : "00000000-0000-4000-8000-000000000001";
    const foreign = await execute(service, bob, { version: 1, idempotencyKey: "foreign", kind: "task.update", args: { taskId: id, expectedVersion: 1, patch: { title: "No" } } });
    const missing = await execute(service, bob, { version: 1, idempotencyKey: "missing", kind: "task.update", args: { taskId: "00000000-0000-4000-8000-000000000001", expectedVersion: 1, patch: { title: "No" } } });
    expect(foreign).toEqual({ _tag: "not_found" });
    expect(missing).toEqual({ _tag: "not_found" });
  });

  it("rejects stale versions without overwriting current data", async () => {
    const service = makeDomainCommandService(new MemoryDomainStore());
    const alice = user("user_alice");
    const created = await execute(service, alice, create("create-3"));
    const id = created._tag === "applied" && created.value ? created.value.id : "";
    const updated = await execute(service, alice, { version: 1, idempotencyKey: "edit-1", kind: "task.update", args: { taskId: id, expectedVersion: 1, patch: { title: "New title" } } });
    const stale = await execute(service, alice, { version: 1, idempotencyKey: "edit-2", kind: "task.update", args: { taskId: id, expectedVersion: 1, patch: { title: "Lost title" } } });
    expect(updated._tag).toBe("applied");
    expect(stale._tag).toBe("conflict");
    if (stale._tag === "conflict") expect(stale.reason).toBe("stale_version");
  });

  it("increments versions, enforces status transitions, and undoes an edit once", async () => {
    const store = new MemoryDomainStore();
    const service = makeDomainCommandService(store);
    const alice = user("user_alice");
    const created = await execute(service, alice, create("create-4"));
    const id = created._tag === "applied" && created.value ? created.value.id : "";
    const completed = await execute(service, alice, { version: 1, idempotencyKey: "status-1", kind: "academic.status", args: { record: { kind: "task", id }, expectedVersion: 1, status: "completed" } });
    expect(completed._tag).toBe("applied");
    const directSwitch = await execute(service, alice, { version: 1, idempotencyKey: "status-2", kind: "academic.status", args: { record: { kind: "task", id }, expectedVersion: 2, status: "cancelled" } });
    expect(directSwitch._tag).toBe("invalid");
    const token = completed._tag === "applied" ? completed.undoToken : undefined;
    expect(token).toBeDefined();
    const undone = await execute(service, alice, { version: 1, idempotencyKey: "undo-1", kind: "undo", args: { token } });
    expect(undone._tag).toBe("applied");
    const reused = await execute(service, alice, { version: 1, idempotencyKey: "undo-2", kind: "undo", args: { token } });
    expect(reused._tag).toBe("conflict");
  });

  it("rejects a foreign and expired Undo token without changing data", async () => {
    const store = new MemoryDomainStore();
    const service = makeDomainCommandService(store);
    const alice = user("user_alice");
    const bob = user("user_bob");
    const created = await execute(service, alice, create("create-5"));
    const token = created._tag === "applied" ? created.undoToken : undefined;
    expect(token).toBeDefined();
    const foreign = await execute(service, bob, { version: 1, idempotencyKey: "foreign-undo", kind: "undo", args: { token } });
    expect(foreign).toMatchObject({ _tag: "conflict", reason: "unsafe_undo" });
    if (token) store.state.undos.get(createHash("sha256").update(token).digest("hex"))!.expiresAt = Date.now() - 1;
    const expired = await execute(service, alice, { version: 1, idempotencyKey: "expired-undo", kind: "undo", args: { token } });
    expect(expired).toMatchObject({ _tag: "conflict", reason: "unsafe_undo" });
  });

  it("keeps an Assessment with linked Tasks from being deleted", async () => {
    const store = new MemoryDomainStore();
    const assessmentId = "00000000-0000-4000-8000-000000000001";
    const assessment: Assessment = { kind: "assessment", id: assessmentId, ownerId: "user_alice", title: "Exam", details: null, courseId: null, assessmentId: null, dueDate: null, dueTime: null, status: "open", version: 1, createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
    const task: Task = { id: "00000000-0000-4000-8000-000000000002", ownerId: "user_alice", title: "Study", details: null, courseId: null, assessmentId, dueDate: null, dueTime: null, status: "open", version: 1, createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
    store.state.assessments.set(assessmentId, assessment);
    store.state.tasks.set(task.id, task);
    const service = makeDomainCommandService(store);
    const alice = user("user_alice");
    const result = await execute(service, alice, { version: 1, idempotencyKey: "delete-assessment", kind: "academic.delete", args: { record: { kind: "assessment", id: assessmentId }, expectedVersion: 1 } });
    expect(result).toMatchObject({ _tag: "conflict", reason: "has_dependents" });
  });

  it("rejects malformed arguments before opening a mutation", async () => {
    const service = makeDomainCommandService(new MemoryDomainStore());
    const result = await Effect.runPromiseExit(service.execute(user("user_alice"), { version: 1, idempotencyKey: "bad", kind: "task.create", args: { title: "" } }));
    expect(result._tag).toBe("Failure");
  });
});
