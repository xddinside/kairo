# Runtime Contract

- Bun `1.3.14` owns installs and repository scripts.
- Node `24.x` runs the TanStack Start and Nitro server boundary.
- `.bun-version`, `.nvmrc`, `package.json`, CI, and the Vercel function duration contract keep those limits visible.
- `bun install --frozen-lockfile` is the only CI install path.
- `bun run dev` remains the local entry point and starts Vite through Portless.
- Vercel preview resources must use an isolated Neon branch and private storage bucket. The preview validator fails closed when an identifier or URL points at production.
- `release_id` is the full commit SHA. Release metadata may contain `pending` while a candidate is being checked, but that value is never evidence that a production gate passed.

The authenticated User boundary now exists behind Clerk request verification, canonical-origin checks, and server-derived ownership. Live Google, email magic-link, provider-dashboard, deployment, and end-to-end two-User proof remain release evidence, not assumptions.
Persistence, model generation, file workflows, observability, recovery, and the other P0 gates remain outside this runtime spine.
