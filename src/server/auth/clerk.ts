import { clerkClient } from "@clerk/tanstack-react-start/server";

import { readCanonicalOrigin } from "./origin";
import {
  requireUser,
  type SessionFailureKind,
  type SessionVerificationResult,
  type SessionVerifier,
} from "./user";

export const classifyClerkSessionFailure = (reason: string | null | undefined): SessionFailureKind => {
  const normalized = reason?.toLowerCase() ?? "";

  if (normalized === "" || normalized.includes("missing")) return "missing_session";
  if (normalized.includes("expired")) return "expired_session";
  if (normalized.includes("revok") || normalized.includes("removed") || normalized.includes("ended")) {
    return "revoked_session";
  }
  return "unknown_session";
};

export const clerkSessionVerifier: SessionVerifier = {
  verify: async (request: Request): Promise<SessionVerificationResult> => {
    const canonicalOrigin = readCanonicalOrigin();
    if (!canonicalOrigin) {
      return { _tag: "rejected", reason: "verification_unavailable" };
    }

    try {
      const requestState = await clerkClient().authenticateRequest(request, {
        acceptsToken: "session_token",
        authorizedParties: [canonicalOrigin.origin],
      });

      if (!requestState.isAuthenticated) {
        return {
          _tag: "rejected",
          reason: classifyClerkSessionFailure(requestState.reason),
        };
      }

      const authState = requestState.toAuth();
      if (!authState.isAuthenticated) {
        return { _tag: "rejected", reason: "unknown_session" };
      }

      return {
        _tag: "verified",
        userId: authState.userId,
        sessionId: authState.sessionId,
      };
    } catch {
      return { _tag: "rejected", reason: "verification_unavailable" };
    }
  },
};

export const requireCurrentUser = (request: Request): Promise<import("./user").AuthenticatedUser> =>
  requireUser(request, clerkSessionVerifier);
