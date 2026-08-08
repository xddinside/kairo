import { describe, expect, it } from "vitest";

import { classifyClerkSessionFailure } from "../../src/server/auth/clerk";
import {
  checkCanonicalOrigin,
  isPrivateRoute,
  isPrototypeRoute,
  isPublicAuthRoute,
  requiresCanonicalOrigin,
} from "../../src/server/auth/origin";
import {
  requireUserFromSession,
  scopeInputToUser,
  type AuthenticatedUser,
  UserBoundaryError,
} from "../../src/server/auth/user";

const canonicalOrigin = new URL("https://kairo.example");

const request = (method: string, headers?: HeadersInit): Request =>
  new Request("https://kairo.example/tasks", { method, headers });

const user = (id: string): AuthenticatedUser =>
  requireUserFromSession({
    _tag: "verified",
    userId: id,
    sessionId: `sess_${id.slice(5)}`,
  });

describe("authenticated User boundary", () => {
  it("maps Clerk session failures to typed safe categories", () => {
    expect(classifyClerkSessionFailure("session-token-missing")).toBe("missing_session");
    expect(classifyClerkSessionFailure("session-token-expired")).toBe("expired_session");
    expect(classifyClerkSessionFailure("session-revoked")).toBe("revoked_session");
    expect(classifyClerkSessionFailure("token-invalid")).toBe("unknown_session");
    expect(classifyClerkSessionFailure(undefined)).toBe("missing_session");
  });

  it("does not expose session failure detail as a public error", () => {
    const failures = [
      "missing_session",
      "unknown_session",
      "expired_session",
      "revoked_session",
    ] as const;

    const publicErrors = failures.map((kind) => {
      try {
        requireUserFromSession({ _tag: "rejected", reason: kind });
        throw new Error("expected failure");
      } catch (error) {
        expect(error).toBeInstanceOf(UserBoundaryError);
        return { message: (error as UserBoundaryError).message, json: JSON.stringify(error) };
      }
    });

    expect(new Set(publicErrors.map((error) => error.message)).size).toBe(1);
    expect(new Set(publicErrors.map((error) => error.json)).size).toBe(1);
  });

  it("removes browser owner hints and uses the verified User", () => {
    const alice = user("user_alice");
    const bob = user("user_bob");
    const scoped = scopeInputToUser(alice, {
      recordId: "record-1",
      ownerId: bob.id,
      userId: bob.id,
      owner_id: bob.id,
    });

    expect(scoped.userId).toBe(alice.id);
    expect(scoped.input).toEqual({ recordId: "record-1" });
  });
});

describe("canonical origin and route guards", () => {
  it("requires the exact configured origin for unsafe requests", () => {
    expect(
      checkCanonicalOrigin(
        request("POST", { Origin: "https://kairo.example", "Sec-Fetch-Site": "same-origin" }),
        canonicalOrigin,
      ),
    ).toEqual({ ok: true });
    expect(checkCanonicalOrigin(request("POST"), canonicalOrigin)).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(checkCanonicalOrigin(request("POST", { Origin: "not-an-origin" }), canonicalOrigin)).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(
      checkCanonicalOrigin(request("POST", { Origin: "https://evil.example" }), canonicalOrigin),
    ).toEqual({ ok: false, reason: "wrong" });
    expect(checkCanonicalOrigin(request("POST", { Origin: "https://kairo.example" }), undefined)).toEqual({
      ok: false,
      reason: "configuration",
    });
  });

  it("does not require an unsafe origin header for safe reads", () => {
    expect(checkCanonicalOrigin(request("GET"), canonicalOrigin)).toEqual({ ok: true });
  });

  it("protects production routes but leaves sign-in and prototypes outside the authority", () => {
    expect(isPrivateRoute("/")).toBe(true);
    expect(isPrivateRoute("/canvas")).toBe(true);
    expect(isPrivateRoute("/courses/course-1")).toBe(true);
    expect(isPrivateRoute("/files/file-1")).toBe(true);
    expect(isPrivateRoute("/tasks/task-1")).toBe(true);
    expect(isPublicAuthRoute("/sign-in/sso-callback")).toBe(true);
    expect(isPrototypeRoute("/proto/lifecycle")).toBe(true);
    expect(isPrivateRoute("/proto/lifecycle")).toBe(false);
  });

  it("guards unsafe server operations and private route mutations", () => {
    expect(requiresCanonicalOrigin(request("POST"), "serverFn", "/proto/lifecycle")).toBe(true);
    expect(requiresCanonicalOrigin(request("POST"), "router", "/tasks")).toBe(true);
    expect(requiresCanonicalOrigin(request("POST"), "router", "/proto/lifecycle")).toBe(false);
    expect(requiresCanonicalOrigin(request("GET"), "serverFn", "/tasks")).toBe(false);
  });
});
