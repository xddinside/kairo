import { createMiddleware } from "@tanstack/react-start";

import { requireCurrentUser } from "./clerk";
import {
  checkCanonicalOrigin,
  isPrivateRoute,
  requiresCanonicalOrigin,
  readCanonicalOrigin,
  type OriginFailureKind,
} from "./origin";
import { isUserBoundaryError, UserBoundaryError } from "./user";

const jsonResponse = (body: string, status: number): Response =>
  new Response(JSON.stringify({ error: body }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const originErrorResponse = (_reason: OriginFailureKind): Response => {
  return jsonResponse("origin_rejected", 403);
};

export const authenticatedUserMiddleware = createMiddleware({ type: "function" }).server(
  async ({ context, next }) => {
    const request = (context as unknown as { readonly kairoRequest?: Request }).kairoRequest;
    if (!request) throw new UserBoundaryError("unauthenticated", "verification_unavailable");

    const user = await requireCurrentUser(request);
    return next({ context: { kairoUser: user } });
  },
);

export const requestBoundaryMiddleware = createMiddleware().server(
  async ({ request, pathname, handlerType, next }) => {
    if (requiresCanonicalOrigin(request, handlerType, pathname)) {
      const originCheck = checkCanonicalOrigin(request, readCanonicalOrigin());
      if (!originCheck.ok) return originErrorResponse(originCheck.reason);
    }

    if (handlerType === "router" && isPrivateRoute(pathname)) {
      try {
        await requireCurrentUser(request);
      } catch (error) {
        if (isUserBoundaryError(error)) {
          return new Response(null, {
            status: 302,
            headers: new Headers({ Location: "/sign-in" }),
          });
        }
        return jsonResponse("authentication_unavailable", 503);
      }
    }

    return next({ context: { kairoRequest: request } });
  },
);

export const userBoundaryFailureResponse = (error: unknown): Response => {
  if (isUserBoundaryError(error)) {
    const isOriginFailure = error.code === "origin_rejected";
    return jsonResponse(isOriginFailure ? "origin_rejected" : "unauthenticated", isOriginFailure ? 403 : 401);
  }
  return jsonResponse("authentication_unavailable", 503);
};
