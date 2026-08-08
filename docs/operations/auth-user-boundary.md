# Authenticated User Boundary

Kairo uses `@clerk/tanstack-react-start` `1.4.29` with TanStack Start. `src/start.ts` installs Clerk request middleware, the canonical-origin boundary, TanStack CSRF checks, and the authenticated function middleware.

## Provider setup

Set these values in the ignored local environment or the deployment provider:

```text
KAIRO_ORIGIN=https://kairo.example
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_SIGN_IN_URL=/sign-in
```

The Clerk instance must enable Google sign-in and email magic links. The `/sign-in/$` route renders Clerk's production flow, including loading, return, verification, expiry, and sign-out states. The component sends users to `/canvas` after a successful session. This checkout has not performed a live Clerk sign-in or dashboard check because no provider credentials were entered.

## Server boundary

`src/server/auth/clerk.ts` verifies the incoming request with Clerk's `authenticateRequest` and the configured canonical origin. It returns only a validated Clerk `userId` and `sessionId` to the Kairo boundary. It never returns or stores a session token.

Later server services must accept `AuthenticatedUser` from `src/server/auth/user.ts` and scope every lookup and command to its `id`. Browser inputs are not an authority for `userId`, `ownerId`, record ownership, or session state. `scopeInputToUser` removes owner hints before a service receives input, and `findOwnedRecord` maps foreign and missing records to the same unavailable result.

## Route and operation policy

The stable production routes are private and redirect unauthenticated requests to `/sign-in`. `/sign-in/*` is public. `/proto/*` remains a non-production prototype surface and is not an authentication authority.

Unsafe private requests require an exact `Origin` match with `KAIRO_ORIGIN`. Missing, malformed, wrong, or unavailable origin configuration fails closed. Forwarding headers do not affect this comparison. Clerk's `authorizedParties` and TanStack's CSRF middleware provide additional request checks.

All current TanStack server functions use the authenticated function middleware. Later private operations must remain behind that middleware and must derive ownership from the verified User context rather than a request field.

## Safe failures

Missing, unknown, expired, revoked, malformed, and unavailable sessions do not expose provider messages, claims, tokens, or account existence. They resolve to the safe `unauthenticated` boundary code. Foreign and missing owned records resolve to the same result at the User boundary.
