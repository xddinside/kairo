# Kairo production data and deployment foundation

Research date: 7 August 2026

## Decision

Use this production baseline:

| Concern | Choice |
| --- | --- |
| Package and local scripts | Bun, using the checked-in `bun.lock` and pinned package versions |
| Production app runtime | Node.js 24 LTS on Vercel Pro through TanStack Start's Nitro Vercel output |
| App boundary | Authenticated TanStack Start server functions and server routes |
| Identity | Clerk's TanStack React Start SDK; Clerk stays the identity source |
| Relational data | Supabase-managed PostgreSQL |
| Schema and migrations | Declarative SQL plus reviewed, timestamped Supabase CLI migrations |
| App data client | A per-request, typed Supabase client carrying the Clerk session token |
| Documents | Private Amazon S3 buckets, reached through short-lived presigned URLs |
| Error and trace monitoring | Sentry's TanStack Start SDK, Vercel runtime logs, and Supabase database reports |
| Database recovery | Supabase PITR plus independent encrypted logical dumps |
| File recovery | S3 Versioning, lifecycle rules, and cross-Region replication |

This choice keeps Kairo portable. PostgreSQL and S3 are standard interfaces, while TanStack Start's Node output can move to a container host if the Vercel adapter becomes a problem.

## Runtime boundary

Bun should install packages and run local and CI scripts. It should not define production behavior. Pin the production runtime with `engines.node: "24.x"`, build with Bun, and run the emitted server on Vercel's Node runtime. Vercel detects `bun.lock`, while TanStack Start documents Vercel and Node deployment through Nitro.

Treat Nitro as a watched dependency. Its Vite integration remains under active development, so pin it and TanStack Start, run a production build in CI, and smoke-test every preview deployment. Preserve the ordinary Node start output as an exit path.

All private reads and writes should cross a TanStack Start server function. Webhooks, health checks, and scheduled jobs should use server routes. Add both Clerk request middleware and TanStack Start's CSRF middleware in `src/start.ts`; defining this file removes Start's implicit CSRF setup. Check authentication again on every private server function because route guards protect navigation, not the endpoint.

Keep secrets, database clients, S3 signing, model calls, and command handlers in `*.server.ts` modules. Do not place a Supabase service-role key, AWS credentials, or model key in a browser bundle. Authenticated responses should use `Cache-Control: private` or `no-store`.

## Identity and per-user authorization

Use `@clerk/tanstack-react-start`. Clerk supplies Google sign-in and email links and exposes verified auth state to Start middleware and server functions.

Supabase has first-class support for Clerk tokens. Build a Supabase client per request with the publishable key and the current Clerk access token. Do not use the service role for normal app requests.

Every user-owned table should have a non-null `owner_id text` whose value is Clerk's `sub` claim. Enable row-level security and add both `USING` and `WITH CHECK` policies based on `auth.jwt()->>'sub'`. Default-deny any table without a policy. Automated authorization tests must prove that user A cannot select, insert, update, or delete user B's rows.

Create a small local profile row lazily on the first authenticated request. Store only Kairo-owned settings there; read name, email, and avatar from Clerk. Clerk warns that webhook copies are eventually consistent and unnecessary when session data is enough. A verified, idempotent `user.deleted` webhook should start account erasure, but sign-in and onboarding must not wait for a webhook.

Canvas and stable routes must call the same server-side commands. Each mutation needs validation, an owner-scoped policy, and an idempotency key. Multi-table actions such as creating a generated view and applying its accepted changes should use a PostgreSQL function so they commit or fail together.

## Database, schema, and migrations

Use one Supabase project per environment: local, staging, and production. Never connect a preview deployment to production data.

Keep PostgreSQL definitions, constraints, indexes, functions, triggers, and row policies in `supabase/schemas/`. Generate and commit timestamped SQL in `supabase/migrations/`, then generate TypeScript database types with the Supabase CLI. Do not add Drizzle as a second schema authority. Kairo needs SQL policies and atomic database functions, and the Supabase CLI already owns their full lifecycle.

The migration gate should:

1. Rebuild a local database from zero with `supabase db reset`.
2. Run schema, authorization, and integration tests.
3. Generate types and fail if the committed output changes.
4. Run `supabase db push --dry-run` against the target.
5. Apply migrations once, outside the app startup path, before deploying code that needs them.

Use expand-and-contract changes for live tables. Never reset production, edit its schema in the dashboard, or include seed data in a production push. Product fixtures may exist only in tests and local development.

## Markdown and PDF storage

Store document metadata in PostgreSQL and original bytes in private S3 buckets. Use an opaque document ID in the object key; never treat a path or filename as proof of ownership.

An upload should follow this flow:

1. An authenticated server function validates the declared Markdown or PDF type and size, creates an owner-scoped `pending` document row, and issues a short-lived presigned upload URL.
2. The browser uploads directly to S3 with a checksum. This avoids Vercel request-size and duration limits.
3. A completion command checks the stored object's size, type, and checksum. Keep new files quarantined until a malware scan passes, then mark the document `ready`.
4. Viewing starts with an owner check against PostgreSQL, then returns a short-lived presigned `GET` URL. Do not make a document bucket public.
5. Deletion removes the active metadata and object, records an auditable erasure job, and clears stale pending uploads through a scheduled cleanup.

Turn on S3 Block Public Access, default encryption, Versioning, and lifecycle rules. Replicate the clean document bucket to a second Region and account. Use a finite backup-retention window so account deletion removes active data at once and aged backup versions expire on schedule.

Supabase Storage is not the primary recommendation because its database backups exclude file bytes and its S3-compatible buckets do not support object versioning. It remains a reasonable later option only if Kairo also builds and tests a separate file-backup pipeline.

## Deployment and scheduled work

Use Vercel Pro for production and separate Clerk, Supabase, Sentry, and AWS settings for preview/staging and production. Protect production environment secrets and require the test, migration, build, and preview smoke gates before release.

Use a database outbox for browser reminders, document cleanup, account erasure, and other scheduled work. A secured Vercel Cron route may claim due rows with a lease and process them in small batches. Vercel does not retry failed cron calls and may deliver one more than once, so every worker needs a unique delivery key, idempotent handlers, bounded retries in the outbox, and an alert for stale work.

## Monitoring and recovery

Use Sentry on both browser and server builds for errors, release-linked source maps, and traces. Add spans around server functions, database calls, file signing, and generated-view work. Do not record prompts, notes, document text, access tokens, signed URLs, or model input/output in logs or traces.

Use Vercel logs for requests and cron calls and Supabase reports for connection count, slow queries, and database health. Alert on:

- elevated server or client error rate;
- authentication or row-policy failures;
- generated-view failures and long requests;
- database saturation or slow queries;
- stale outbox work;
- failed or stale backups.

Enable at least seven days of Supabase point-in-time recovery before accepting real users. In addition, run a nightly `supabase db dump` from a scheduled GitHub Actions workflow and write the encrypted dump to the replicated backup S3 bucket. Schedule away from the start of the hour, support manual dispatch, and alert if no fresh dump appears; GitHub notes that scheduled runs can be delayed or dropped.

Restore tests are part of the design, not a later task. Each month, restore the newest database dump into an isolated project and sample file versions from the replica. Record the achieved recovery point and recovery time. A backup is not accepted until this drill succeeds.

## Production gates this decision creates

- Two-user row-level-security tests cover every private table and storage-signing command.
- A clean database can be rebuilt only from committed migrations.
- Preview and staging use no production data or credentials.
- Direct S3 upload, quarantine, scan, view, deletion, and expired-URL cases work on desktop and mobile.
- Backup freshness alerts exist, and a restore drill has passed.
- A Vercel preview proves SSR, server functions, streaming, Clerk, Sentry source maps, and scheduled-route authentication before production launch.

## Official evidence

- [TanStack Start hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [TanStack Start server functions and CSRF guidance](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [Vercel package-manager detection](https://vercel.com/docs/package-managers)
- [Vercel Node.js 24 LTS runtime](https://vercel.com/changelog/node-js-24-lts-is-now-generally-available-for-builds-and-functions)
- [Clerk's TanStack React Start quickstart](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart)
- [Clerk guidance on local user copies and webhooks](https://clerk.com/docs/guides/development/webhooks/syncing)
- [Supabase's first-class Clerk integration and RLS](https://supabase.com/docs/guides/auth/third-party/clerk)
- [Supabase local schema and migration workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase database backups and PITR](https://supabase.com/docs/guides/platform/backups)
- [Supabase Storage S3 limits](https://supabase.com/docs/guides/storage/s3/compatibility)
- [Amazon S3 presigned uploads and downloads](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
- [Amazon S3 security practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
- [Amazon S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)
- [Amazon S3 cross-Region replication](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html)
- [Sentry trace metrics for TanStack Start](https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/tracing/span-metrics/performance-metrics/)
- [Vercel Cron behavior](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [GitHub scheduled-workflow limits](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows)
