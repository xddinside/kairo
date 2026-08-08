import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { CommandEnvelope } from "../../src/server/domain/schema";

describe("Domain command schemas", () => {
  it("accepts the fixed versioned envelope", () => {
    expect(Schema.decodeUnknownSync(CommandEnvelope)({ version: 1, idempotencyKey: "key", kind: "task.create", args: { title: "Task" } })).toMatchObject({ version: 1, kind: "task.create" });
  });

  it("rejects client ownership and invalid dates", () => {
    expect(() => Schema.decodeUnknownSync(CommandEnvelope)({ version: 1, idempotencyKey: "key", kind: "task.create", ownerId: "user_bob", args: { title: "Task", dueDate: "tomorrow" } })).toThrow();
  });
});
