export const sessionFailureKinds = [
  "missing_session",
  "unknown_session",
  "expired_session",
  "revoked_session",
  "verification_unavailable",
] as const;

export type SessionFailureKind = (typeof sessionFailureKinds)[number];

declare const userIdBrand: unique symbol;
declare const sessionIdBrand: unique symbol;

export type UserId = string & { readonly [userIdBrand]: "UserId" };
export type SessionId = string & { readonly [sessionIdBrand]: "SessionId" };

export type AuthenticatedUser = Readonly<{
  readonly id: UserId;
  readonly sessionId: SessionId;
}>;

export type SessionVerificationResult =
  | Readonly<{
      readonly _tag: "verified";
      readonly userId: string;
      readonly sessionId: string;
    }>
  | Readonly<{
      readonly _tag: "rejected";
      readonly reason: SessionFailureKind;
    }>;

export interface SessionVerifier {
  readonly verify: (request: Request) => Promise<SessionVerificationResult>;
}

export type UserBoundaryErrorCode = "unauthenticated" | "origin_rejected";

export class UserBoundaryError extends Error {
  readonly code: UserBoundaryErrorCode;
  readonly kind!: SessionFailureKind | "missing" | "malformed" | "wrong" | "configuration";

  constructor(
    code: UserBoundaryErrorCode,
    kind: SessionFailureKind | "missing" | "malformed" | "wrong" | "configuration",
  ) {
    super(code === "unauthenticated" ? "Authentication required" : "Request origin rejected");
    this.name = "UserBoundaryError";
    this.code = code;
    Object.defineProperty(this, "kind", { value: kind, enumerable: false });
  }
}

const clerkUserIdPattern = /^user_[A-Za-z0-9_-]+$/;
const clerkSessionIdPattern = /^sess_[A-Za-z0-9_-]+$/;

export const toUserId = (value: string): UserId | undefined =>
  clerkUserIdPattern.test(value) ? (value as UserId) : undefined;

export const toSessionId = (value: string): SessionId | undefined =>
  clerkSessionIdPattern.test(value) ? (value as SessionId) : undefined;

export const requireUserFromSession = (
  result: SessionVerificationResult,
): AuthenticatedUser => {
  if (result._tag === "rejected") {
    throw new UserBoundaryError("unauthenticated", result.reason);
  }

  const id = toUserId(result.userId);
  const sessionId = toSessionId(result.sessionId);

  if (!id || !sessionId) {
    throw new UserBoundaryError("unauthenticated", "unknown_session");
  }

  return Object.freeze({ id, sessionId });
};

export const requireUser = async (
  request: Request,
  verifier: SessionVerifier,
): Promise<AuthenticatedUser> => requireUserFromSession(await verifier.verify(request));

export const isUserBoundaryError = (value: unknown): value is UserBoundaryError => {
  if (value instanceof UserBoundaryError) return true;
  if (!value || typeof value !== "object") return false;

  const code = (value as { readonly code?: unknown }).code;
  return code === "unauthenticated" || code === "origin_rejected";
};

type OwnerHintKey = "ownerId" | "userId" | "owner_id";
type WithoutOwnerHints<T> = Omit<T, OwnerHintKey>;

export const scopeInputToUser = <T extends Record<string, unknown>>(
  user: AuthenticatedUser,
  input: T,
): Readonly<{ readonly userId: UserId; readonly input: WithoutOwnerHints<T> }> => {
  const safeInput = Object.fromEntries(
    Object.entries(input).filter(([key]) => !["ownerId", "userId", "owner_id"].includes(key)),
  ) as WithoutOwnerHints<T>;

  return Object.freeze({ userId: user.id, input: safeInput });
};

export const findOwnedRecord = <T extends Readonly<{ readonly id: string; readonly ownerId: UserId }>>(
  user: AuthenticatedUser,
  records: ReadonlyArray<T>,
  recordId: string,
): T | undefined => records.find((record) => record.id === recordId && record.ownerId === user.id);
