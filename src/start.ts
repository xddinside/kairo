import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

import { readCanonicalOrigin } from "./server/auth/origin";
import {
  authenticatedUserMiddleware,
  requestBoundaryMiddleware,
} from "./server/auth/middleware";

const canonicalOrigin = readCanonicalOrigin();
const canonicalOriginValue = canonicalOrigin?.origin ?? "";

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === "serverFn",
  origin: canonicalOriginValue,
  secFetchSite: "same-origin",
  referer: false,
  allowRequestsWithoutOriginCheck: false,
  failureResponse: new Response(JSON.stringify({ error: "origin_rejected" }), {
    status: 403,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  }),
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    clerkMiddleware({
      publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
      authorizedParties: canonicalOrigin ? [canonicalOrigin.origin] : [],
      signInUrl: "/sign-in",
      signUpUrl: "/sign-in",
    }),
    requestBoundaryMiddleware,
    csrfMiddleware,
  ],
  functionMiddleware: [authenticatedUserMiddleware],
}));
