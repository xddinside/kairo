# Kairo database platform comparison

Research date: 7 August 2026

## Decision

Use **Neon Postgres** as Kairo's main database.

Keep Clerk as the identity source, private Amazon S3 buckets for Markdown and PDF files, and TanStack Start server functions as the only browser-to-data boundary. Use Drizzle for typed queries and checked-in SQL migrations. Add realtime only to flows that prove they need it.

Do not combine Neon with Supabase or Convex. A second live data system would add another policy surface, another failure mode, and cross-store consistency work without serving a current need.

This replaces the earlier Supabase database recommendation. That choice made sense when Supabase Auth, Storage, client data APIs, and Realtime were still open options. Kairo has since chosen other owners for three of those jobs and needs only narrow realtime support.

## Fixed Kairo constraints

- Clerk owns sign-in and identity.
- TanStack Start server functions own private reads, writes, model calls, and commands.
- S3 owns original Markdown and PDF bytes.
- Kairo's academic data is relational: users, courses, timetable entries, tasks, deadlines, canvases, generated views, source notes, and accepted changes.
- Each canvas keeps an ordered generated-view history.
- Most screens can use request refresh, optimistic updates, or short polling. Realtime is selective, not the main data model.
- Production needs clean migrations, preview isolation, per-user access tests, point-in-time recovery, and a credible exit path.

## Neon Postgres vs Supabase Postgres

| Area | Neon | Supabase | Kairo result |
| --- | --- | --- | --- |
| Vercel and serverless connections | The Vercel integration supplies pooled URLs and can create a copy-on-write database branch for each preview. Neon also has a GA HTTP/WebSocket serverless driver. | Supavisor transaction mode supports serverless workloads. Preview branches are separate Supabase stacks and start without production data. | **Neon.** Its preview database workflow maps directly to Vercel previews and keeps schema plus test data isolated. |
| Clerk and per-user access | Clerk documents Neon with Drizzle and server-side owner filters. Neon supports Postgres RLS with JWT/JWKS, including Clerk, through Neon RLS. | Supabase has a first-class Clerk third-party-auth integration whose token works with Database RLS, Storage, and Realtime. | **Supabase for direct client access; tie behind Kairo's server.** Kairo can keep Clerk checks in server functions and enforce portable Postgres RLS as defence in depth. |
| Relational data and transactions | Standard Postgres, SQL constraints, joins, functions, and transactions. | Standard Postgres with the same core guarantees. | **Tie.** Both fit the academic model and ordered canvas/view history. |
| Migrations | Provider-neutral SQL works with Drizzle Kit or any normal Postgres migration tool. Use the direct URL for migrations. | The Supabase CLI provides a strong local schema, diff, reset, and migration workflow. | **Supabase for its all-in-one local workflow; Neon for portability.** Choose Drizzle plus reviewed SQL so the schema does not depend on either host. |
| Local development and tests | A local Postgres container is enough for normal SQL and RLS tests. Neon Local can switch a stable local URL between cloud branches, but it is not a local Postgres server. The Neon HTTP driver needs a proxy when pointed at local Postgres. | The Supabase CLI can run the full stack locally with Docker and rebuild it from migrations. | **Supabase** if the full Supabase stack is used. For Kairo's Postgres-only use, ordinary local Postgres is simpler. |
| Branching and previews | Copy-on-write branches can include parent data, expire automatically, and connect to Vercel previews. Launch includes 10 branches, then about $0.002 per branch-hour. | Preview branches are isolated full stacks, start without main data, pause when idle, and cost $0.01344 per branch-hour on paid plans. | **Neon.** Faster production-like previews, lower branch cost, and fewer unused services. Use schema-only or scrubbed parent data for privacy. |
| Compute scaling | Compute autoscales within set bounds and can scale to zero after five idle minutes. Paid plans can disable scale-to-zero for a steady production path. | Production compute uses a chosen hourly size. Paid projects never pause; scale changes need a compute choice. | **Neon** for Kairo's early, uneven load. Disable scale-to-zero if wake delay harms reminders or request latency. |
| Backup and restore | Launch includes up to seven days of time travel and instant restore; Scale includes up to 30 days. History storage is usage-based. | Pro includes seven daily backups. PITR costs $100 per month for each seven days of retention and requires at least Small compute. | **Neon** for an affordable production recovery point. Both still need encrypted off-site logical dumps and restore drills. |
| Extensions and AI search | Supports standard extensions, including `pgvector`. | Supports many extensions, including `vector`. | **Tie.** Start with Postgres full-text search; enable `pgvector` only when a measured retrieval use case needs embeddings. |
| Realtime | No bundled browser subscription product. It supports Postgres logical replication, which keeps a subscriber connected and prevents scale-to-zero. | Realtime supplies Broadcast, Presence, and Postgres Changes. Supabase now recommends Broadcast for scale and security. | **Supabase**, but Kairo does not need this across the app. Use optimistic UI and refetch first; add SSE or a small service only for proven live flows. |
| Cost shape | Launch bills compute by actual CU-hours and storage use. The current example for intermittent load is about $15 per month. | Pro starts at $25 per month; fixed compute runs all month. Branches and PITR cost extra. | **Neon** for low and bursty v1 traffic. Put spend alerts and maximum autoscale limits in place because usage bills vary. |
| Portability | Normal Postgres URLs, SQL, `pg_dump`, logical replication, and common drivers. Neon-specific branching and scale controls stay outside the schema. | The database is Postgres and portable, but adopting PostgREST, Auth, Storage, Realtime, or platform-specific SQL increases the exit cost. | **Neon** under the proposed narrow use. Both remain portable if Kairo keeps provider features outside its domain model. |
| Operating load | One focused database service, one app server, Clerk, and S3. Kairo must own server commands, RLS context, and any narrow realtime path. | One broader platform can operate database APIs, Realtime, Auth, and Storage. With Clerk and S3, several of those services become unused or duplicate. | **Neon.** It has fewer overlapping owners for Kairo's settled stack. |

## Authorization design on Neon

All private data calls must enter through authenticated TanStack Start server functions. Each command gets the verified Clerk `userId`; no browser-supplied owner ID is trusted.

Use two database roles:

- a migration owner used only by CI and recovery work;
- a runtime role that does not own tables and cannot bypass RLS.

Every user-owned table has a non-null `owner_id text`. App queries must include the owner filter, and RLS must default-deny cross-user access. Set the verified Clerk user ID in transaction-local Postgres context before user-data queries, then base policies on that value. This approach works with standard Postgres and survives a host move. Keep each context set and its reads or writes in one transaction when using a transaction pooler.

Neon RLS can instead verify a Clerk JWT and expose `auth.user_id()` to policies over its HTTP path. It is a valid later simplification, but Kairo does not need a direct browser-to-database path now. The portable transaction-context policy is the safer baseline for a private server boundary.

Automated tests must prove that user A cannot select, insert, update, or delete user B's rows. They must run with the runtime role, not the migration owner. Tests should also cover generated-view ordering, canvas archive and delete behavior, and accepted AI changes as one transaction.

## Migration and preview workflow

Keep Drizzle schema declarations and generated SQL migrations in Git. Review the SQL; never use schema push against production.

The gate is:

1. Start clean local Postgres and apply every committed migration.
2. Run constraints, RLS, transaction, and integration tests.
3. Create or select the Neon preview branch for the Vercel preview.
4. Apply migrations through the unpooled preview URL.
5. Run the preview smoke tests with preview-only Clerk, S3, and model keys.
6. Apply the same migration set once to production before code that needs it.

Use expand-and-contract migrations on live tables. Do not run migrations during ordinary app startup. Preview branches must not carry raw production notes or documents; use schema-only branches or scrubbed data.

## Selective realtime plan

Do not hold a database replication subscriber open for basic Kairo flows. It disables Neon's scale-to-zero and adds a service that must reconnect, filter, authorize, and catch up.

Use this order:

1. optimistic updates for commands initiated in the current browser;
2. refetch on focus, route entry, and successful commands;
3. short polling for a visible long-running generation;
4. server-sent events for a proven need such as streamed generation status;
5. a logical-replication consumer only if multi-client live updates become a core product need.

## Why not Convex

Convex has strong Clerk and TanStack Start support, automatic reactive query subscriptions, serializable mutation transactions, preview deployments, schedules, and useful TypeScript tooling. It is a good choice when live shared state is the product's centre.

It is not the right core for Kairo:

| Area | Convex fit | Kairo concern |
| --- | --- | --- |
| Data model | JSON-like documents with references, indexes, and optional schemas | Kairo's course, task, timetable, deadline, canvas, view, and change data benefits from SQL constraints, joins, reporting, and common admin tools. |
| App boundary | Queries, mutations, and actions form a second backend API and runtime | This duplicates or replaces the chosen TanStack server-function boundary. Node actions cannot access the database directly; each query or mutation they call is a separate transaction. |
| Authorization | Clerk tokens are well supported; each Convex function checks identity and access | There is no Postgres RLS backstop. Kairo would rely on every function keeping owner checks correct. |
| Realtime | Every query is cached and subscribable | Stronger than Kairo needs and tied to subscription updates and function-call usage. |
| Migrations | TypeScript schemas and an online migration component support resumable data changes | The workflow and data model are Convex-specific, not SQL that any Postgres host can apply. |
| Local tests | Local deployments exist but remain beta; tests use a JS mock or an open-source backend with stated limits | More setup and a larger gap from Kairo's ordinary relational database tooling. |
| Recovery | Logical snapshots can include files; daily backups retain seven days and weekly backups fourteen days on Professional | The official recovery docs do not provide point-in-time restore for serverless deployments. |
| Files | Built-in storage accepts all file types | Generated file URLs are bearer URLs and do not expire; checked serving through HTTP actions is limited to 20 MB. S3 presigned URLs better fit private PDFs. |
| Cost and lock-in | Usage follows function calls, database I/O, action compute, storage, search, and egress | Reactive updates count as function calls. Exports are JSONL snapshots, but app functions, queries, schemas, IDs, and transactions need a rewrite to leave Convex. |

A Neon-plus-Convex split is not justified. Putting only live canvas state or AI jobs in Convex would create two sources of truth and cross-system failure cases. PostgreSQL plus an outbox can own durable work; narrow SSE or polling can cover the present live flows.

## Production checks

- Cross-user authorization tests pass against the non-owner runtime role.
- Every schema change rebuilds a blank database and applies cleanly to an isolated preview branch.
- Preview branches contain no private production notes or S3 credentials.
- Production has a seven-day restore window, nightly encrypted logical dumps in the backup S3 account, and a tested restore runbook.
- Scale-to-zero, autoscale bounds, spend alerts, slow-query alerts, and connection metrics have explicit settings.
- A load test covers first request after idle, steady requests, and a burst of concurrent server functions.
- Realtime code ships only with an owner-filtering test, disconnect recovery, and proof that polling or refetch is not enough.

## Official evidence

### Neon and Clerk

- [Neon pricing and plan limits](https://neon.com/pricing)
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon branching and Vercel previews](https://neon.com/docs/guides/branching-intro)
- [Neon row-level security options](https://neon.com/docs/guides/row-level-security)
- [Clerk's Neon integration](https://clerk.com/docs/guides/development/integrations/databases/neon)
- [Neon scale to zero](https://neon.com/docs/introduction/scale-to-zero)
- [Neon logical replication](https://neon.com/docs/guides/logical-replication-neon)
- [Neon `pgvector` support](https://neon.com/docs/ai/ai-concepts)
- [Migrating Neon data with `pg_dump` and `pg_restore`](https://neon.com/docs/import/migrate-from-neon)

### Supabase

- [Supabase connection choices for serverless apps](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase Clerk integration](https://supabase.com/docs/guides/auth/third-party/clerk)
- [Supabase local migration workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase branching](https://supabase.com/docs/guides/deployment/branching)
- [Supabase Realtime subscriptions](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [Supabase backups and PITR](https://supabase.com/docs/guides/platform/backups)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase Postgres extensions](https://supabase.com/docs/guides/database/extensions)

### Convex

- [Convex with Clerk and TanStack Start](https://docs.convex.dev/client/tanstack/tanstack-start/clerk)
- [Convex database model](https://docs.convex.dev/database/overview)
- [Convex function and transaction model](https://docs.convex.dev/functions/overview)
- [Convex actions](https://docs.convex.dev/functions/actions)
- [Convex schemas and migrations](https://docs.convex.dev/database/schemas)
- [Convex local deployments](https://docs.convex.dev/cli/local-deployments)
- [Convex testing](https://docs.convex.dev/testing/overview)
- [Convex backup and restore](https://docs.convex.dev/database/backup-restore)
- [Convex file-storage security](https://docs.convex.dev/file-storage/overview)
- [Convex limits and pricing units](https://docs.convex.dev/production/state/limits)
