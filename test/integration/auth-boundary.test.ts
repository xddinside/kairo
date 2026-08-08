import { describe, expect, it } from "vitest";

import {
  findOwnedRecord,
  requireUser,
  requireUserFromSession,
  type AuthenticatedUser,
  type SessionVerifier,
} from "../../src/server/auth/user";

const request = new Request("https://kairo.example/tasks");

const verifiedUser = (id: string): AuthenticatedUser =>
  requireUserFromSession({
    _tag: "verified",
    userId: id,
    sessionId: `sess_${id.slice(5)}`,
  });

describe("server-derived User integration boundary", () => {
  it("derives the current User from a verified session and ignores input ownership", async () => {
    const alice = verifiedUser("user_alice");
    const bob = verifiedUser("user_bob");
    const verifier: SessionVerifier = {
      verify: async () => ({
        _tag: "verified",
        userId: alice.id,
        sessionId: alice.sessionId,
      }),
    };

    const current = await requireUser(request, verifier);
    const hintedRecord = {
      id: "record-1",
      ownerId: bob.id,
      value: "bob-private",
    } as const;

    expect(current.id).toBe(alice.id);
    expect(findOwnedRecord(current, [hintedRecord], hintedRecord.id)).toBeUndefined();
  });

  it("returns the same boundary result for missing and foreign records", () => {
    const alice = verifiedUser("user_alice");
    const bob = verifiedUser("user_bob");
    const records = [
      { id: "alice-record", ownerId: alice.id },
      { id: "bob-record", ownerId: bob.id },
    ] as const;

    const missing = findOwnedRecord(alice, records, "does-not-exist");
    const foreign = findOwnedRecord(alice, records, "bob-record");

    expect(missing).toBeUndefined();
    expect(foreign).toBeUndefined();
    expect({ tag: missing ? "found" : "not_found" }).toEqual({
      tag: foreign ? "found" : "not_found",
    });
  });

  it("rejects unverified, malformed, expired, and revoked sessions", async () => {
    const failures = [
      "missing_session",
      "unknown_session",
      "expired_session",
      "revoked_session",
    ] as const;

    for (const reason of failures) {
      const verifier: SessionVerifier = {
        verify: async () => ({ _tag: "rejected", reason }),
      };

      await expect(requireUser(request, verifier)).rejects.toMatchObject({
        code: "unauthenticated",
        message: "Authentication required",
      });
    }
  });

  it("rejects a verified session whose identity shape is not a Clerk User", () => {
    expect(() =>
      requireUserFromSession({
        _tag: "verified",
        userId: "foreign-account",
        sessionId: "sess_alice",
      }),
    ).toThrow("Authentication required");
  });
});
