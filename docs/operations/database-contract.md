# Database Contract

Kairo has one Drizzle schema in `src/server/database/schema.ts` and checked-in SQL in `drizzle/`. Drizzle owns tables, constraints, indexes, and migrations. Effect owns the request transaction seam, runtime-role checks, transaction-local identity, typed failures, row decoding, repositories, and services. Kairo does not use Effect SQL, Effect RPC, or HttpApi.

## Roles

`DIRECT_DATABASE_URL` is the migration connection and must use `DATABASE_MIGRATION_ROLE`. `DATABASE_URL` is the pooled runtime connection and must use `DATABASE_RUNTIME_ROLE`. The roles must differ. The runtime service checks `current_user`, `rolsuper`, and `rolbypassrls` before every transaction. A superuser, a role with `BYPASSRLS`, the migration role, or an unexpected runtime role is rejected.

Migration SQL enables and forces RLS on every private table. The runtime transaction sets `app.current_user_id` with parameterized `set_config(..., true)` before owner-scoped work. Missing identity yields no private rows and cannot satisfy an insert or update policy. Application queries still include owner scope so foreign and missing ids share one safe result.

The browser imports neither `postgres`, Drizzle, database URLs, credentials, nor database services. Route code calls server functions, which derive `AuthenticatedUser` from Clerk and then invoke Effect services.

## Data Model

The model includes User, Course, Task, Assessment, Timetable entry and exceptions, Note, File and derived chunks/jobs, Canvas activities and immutable Generated views, Focus sessions, notification preferences/events/deliveries/subscriptions, exports and cleanup jobs, Domain commands, and Undo tokens. Deadlines remain a query over dated Tasks and Assessments.

Private relations use composite `(id, owner_id)` foreign keys where a relation can otherwise cross Users. Assessment deletion is blocked while a live Task links to it. Tombstones hide deleted academic records for the retention window; Undo stores a server-held inverse and an opaque token hash in a private table.

## Verification

`bun run test:database` starts a disposable embedded PostgreSQL cluster when no isolated URL is supplied. The cluster creates a prior unrelated table, creates separate migration and runtime roles, migrates as the migration role, grants only runtime DML, and removes its temporary directory after the tests. The database tests cover empty migration, preservation of prior data, role attributes, forced RLS, missing and forged identity, two-User isolation, same-owner foreign keys, and transaction rollback.

Set `KAIRO_DATABASE_TEST_URL` and `KAIRO_DATABASE_MIGRATION_URL` only for isolated test or preview databases. The test URL guard rejects production-shaped targets. `bun run db:migrate` requires `DIRECT_DATABASE_URL` and never uses `DATABASE_URL`.
