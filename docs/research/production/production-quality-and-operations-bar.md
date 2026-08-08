# Kairo production quality and operations bar

Status: resolved for production v1 planning
Research date: 2026-08-08
Map: [Chart Kairo production v1](https://github.com/xddinside/kairo/issues/3)
Question: [Research and define Kairo production quality and operations bar](https://github.com/xddinside/kairo/issues/11)

## Decision

Kairo may accept real student data only after every P0 gate in this document passes. A passing type check or build is not a production claim. The current checkout is still a UI prototype: it has no Clerk, Neon, Drizzle, Filebase, OpenCode Go, Sentry, production test runner, or deployed server boundary. The baseline `bun run check` and `bun run build` pass, but the P0 gates below remain open until the production path exists and is tested.

The release owner records one signed release record for each production deployment. It names the commit, schema migration, catalog and prompt versions, provider model, environment, test results, backup point, and rollback target. A missing result is a failed gate, not an assumed pass.

## Fixed inputs

These choices come from the resolved map tickets and are not reopened here:

- Bun remains the install and script tool. Kairo runs on Node 24 through TanStack Start's Vercel/Nitro boundary. See [TanStack Start hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting).
- Clerk owns identity. Every private TanStack Start server function or route verifies the current session and derives the User id on the server. Clerk's TanStack React Start quickstart notes that middleware does not protect routes by default, so Kairo must opt in for every private route. Set `authorizedParties` to Kairo's production origins, use production keys and the production instance, and keep academic data out of session claims. See [Clerk TanStack React Start](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart), [session tokens](https://clerk.com/docs/guides/sessions/session-tokens), and [authenticateRequest](https://clerk.com/docs/reference/backend/authenticate-request).
- Neon is the PostgreSQL source of truth. Drizzle owns the typed schema and checked-in SQL migrations; the application uses a pooled connection and a non-owner runtime role. See [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [Neon row-level security](https://neon.com/docs/guides/row-level-security), and [Drizzle migrations](https://orm.drizzle.team/docs/migrations).
- Filebase Free sits behind `FileStorage` for the current no-bill launch. Files stay private and are read or written with owner-checked, short-lived presigned URLs. See [Filebase presigned URLs](https://filebase.com/docs/s3-api/presigned-urls), [Filebase encryption](https://filebase.com/docs/concepts/encryption), and [Filebase pricing and caps](https://filebase.com/docs/account/pricing). Provider limits must be checked at every release because the published plan pages can change.
- OpenCode Go's `deepseek-v4-flash` sits behind the Kairo-owned model gateway. The key stays server-side. The gateway owns quotas, timeouts, cancellation, validation, repair, redaction, and provider error mapping. See [OpenCode Go](https://dev.opencode.ai/docs/go/).
- Effect v4 is the application model for server workflows and shared client state. The Kairo catalog, schema, validator, renderer, and Domain command service remain the trust boundary.
- Sentry receives redacted browser and server errors and traces. Vercel handles preview and production deployments. See [Vercel environments](https://vercel.com/docs/deployments/overview) and [Sentry privacy controls](https://docs.sentry.io/security-legal-pii/scrubbing/protecting-user-privacy/).

## Release classes

| Class | Users | Required state |
| --- | --- | --- |
| Local | Developers only | P0 checks may be incomplete. No real student data or production secrets. |
| Preview | Test users and reviewers | P0 checks for the changed path pass; data uses an isolated Neon branch and test Filebase bucket. |
| Private beta | Named students with real data | Every P0 gate passes, restore drill is recorded, deletion/export works, and an incident contact is named. |
| Public production | Any student | Every P0 and P1 gate passes, provider terms and retention are approved, and rollback has been rehearsed. |

## P0 gates

P0 failures block private beta and public production. Each gate needs the listed evidence in CI, a preview check, or the release record.

| Area | Gate | Evidence and threshold | Owner |
| --- | --- | --- | --- |
| Reproducible build | The same lockfile and runtime build everywhere | `bun install --frozen-lockfile`, `bun run check`, and `bun run build` pass from a clean checkout. Node 24 is pinned in deployment settings. No unreviewed high or critical dependency advisory. | CI |
| Authentication | No private route works without a valid Clerk session | Unauthenticated requests return 401 or the documented sign-in redirect. Expired, revoked, tampered, wrong-origin, and wrong-environment sessions fail. Test Clerk's roughly 60-second token expiry and refresh path, set an explicit maximum session lifetime and inactivity policy, configure `authorizedParties` for production origins, use production keys and instance, and keep custom claims below 1.2 kB. No Clerk secret or provider key appears in client output. | Server owner |
| Ownership | A User can read and change only their own records | Integration tests run as two Users against Neon. Every table has an owner policy. Foreign and unknown ids return the same not-found result. Tests cover Canvas, generated views, Tasks, Assessments, Timetable entries, Notes, Files, Focus sessions, exports, Undo, and deletion. | Data owner |
| Database safety | Queries and writes use the approved boundary | Browser code cannot connect to Neon. Runtime credentials use a non-owner role. One Domain command is one transaction with an idempotency key and expected versions. Drizzle migrations are reviewed SQL files; `push` is not a production migration path. | Data owner |
| Model trust | Generated output cannot become code or an unapproved write | The validator rejects unknown components, props, references, URLs, handlers, HTML, CSS, provider objects, malformed actions, and partial specs. A repair attempt is bounded to one. Model tools are read-only. A mutating Action becomes one server-authorized Domain command. | Model owner |
| Model budget | A user or provider outage cannot exhaust the service | At most one generation per Canvas and two active generations per User. Default quota is 10 generation operations per User per hour and 50 per day; return a retryable quota state at the limit. Verify the configured model id and `/v1/models` at deploy. Alert at 80% and 100% of the OpenCode Go 5-hour, weekly, and monthly limits. | Model owner |
| Model privacy | Student content is not copied into logs or sent to an unapproved provider | The gateway sends only the selected User-owned context. Request and response bodies, File bytes, raw prompts, and model output are absent from logs and Sentry. The release record stores the provider privacy page and the date it was checked. OpenCode Go currently states that providers follow zero retention and do not train on data; treat that as a vendor claim to recheck before every production release. | Privacy owner |
| File upload | Markdown and PDF are private and validated twice | Server checks authenticated owner, extension, detected type and file signature, size, count, and object key. Use a random server key, never a user filename as a key. Provisional caps until the File ticket finalizes them: 5 MiB Markdown, 25 MiB PDF, 20 active Files per User, 200 PDF pages, and 30 seconds extraction time. Reject or quarantine failures. See [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). | File owner |
| File access | A copied URL is not permanent access | Kairo checks the User against Neon metadata before issuing a URL. View URLs expire in 10 minutes; upload URLs expire in 10 minutes; delete and export operations are server-side and idempotent. Public buckets and public object URLs are forbidden. | File owner |
| Account deletion | Deletion is complete and repeatable | Account deletion marks a tombstone first, blocks new work, deletes owned Neon rows and Filebase objects, revokes active sessions, and retries failed object deletion. A second request returns the same terminal result. Live data is inaccessible within 24 hours. Backup copies age out within the declared backup window and cannot resurrect a deleted User without reapplying tombstones. | Account and data owners |
| Export | A User can recover their own data | Export includes structured academic data, Notes as Markdown, and original Markdown/PDF bytes. The archive is generated server-side, has a random key, expires after 15 minutes, is single-use, and never appears in logs. An end-to-end test verifies a round trip from export to a clean account-shaped fixture. | Account owner |
| Browser security | The response has a narrow security policy | Production sends HTTPS, HSTS, CSP, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, and MIME-sniffing protection. Start CSP in report-only mode, fix reports for seven days, then enforce. Do not use `unsafe-eval`; use explicit origins and nonces where needed. Session cookies are Secure, HttpOnly, and SameSite=Lax or Strict. See [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) and [MDN cookies](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies). | Web owner |
| Input and output safety | User content cannot run as markup or a script | Notes and extracted Markdown are rendered through a safe allowlist; no raw HTML or event attributes. Every command, search parameter, file name, and provider response is validated on the server. Run XSS, CSRF, SQL injection, path traversal, object-key, and SSRF tests. Use the [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/) checklist as the security review index. | Web and data owners |
| Accessibility | The full core process meets WCAG 2.2 AA | No known Level A or AA failure in sign-in, onboarding, Canvas generation, Clarification, Domain command, Undo, route CRUD, Focus, File view, export, or deletion. Automated checks are supplemented by keyboard and screen-reader review. Text contrast is at least 4.5:1, large text at least 3:1, focus is visible, status messages are announced, and the 24 CSS pixel target-size rule is met where applicable. See [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and the [ARIA APG](https://www.w3.org/WAI/ARIA/apg/). | UI owner |
| Responsive use | Mobile is a complete operating surface | Playwright smoke tests pass at 320x568, 360x800, 768x1024, and 1280x800. The core process has no horizontal overflow, clipped controls, unreachable dialogs, or desktop-only action. Test touch, keyboard, reduced motion, zoom to 200%, and a slow mobile connection. | UI owner |
| Performance | Real users see a fast and stable app | At the 75th percentile, mobile and desktop meet LCP <= 2.5s, INP <= 200ms, and CLS <= 0.1. Authenticated read routes have p95 server time <= 500ms; ordinary Domain commands have p95 <= 1.5s, excluding provider work. The first generation transition event arrives within 2s and the bounded generation timeout is 60s. A route's initial compressed JavaScript budget is 250 kB. See [Web Vitals](https://web.dev/articles/vitals). | Performance owner |
| Browser support | The supported matrix is explicit and tested | Support the current and previous major versions of Chrome, Edge, Firefox, Safari on macOS, Safari on iOS, and Chrome on Android. Use Baseline Widely Available features unless a tested fallback exists. IE, obsolete Android browsers, and unknown in-app webviews are not supported. See [MDN Baseline](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility). | UI owner |
| Recovery | Failures preserve user work | A provider timeout, quota error, validation failure, or service error keeps the last usable Generated view and produces a safe recovery state. Lost generation responses resume by operation id; lost command responses retry the same idempotency key. No retry repeats a committed mutation. Cancellation is best effort and is tested during every terminal state. | Server and model owners |
| Database recovery | Data can be restored without guessing | Protect the production branch. Configure and record the maximum seven-day Neon Launch history/PITR window instead of accepting the current six-hour free or one-day paid default. Run an encrypted nightly logical backup outside Neon, retain it for 30 days, and run a monthly restore drill into an isolated branch. Target RPO is 24 hours and target RTO is four hours. The drill verifies row counts, ownership policies, migrations, and a sample Canvas/File metadata path. See [Neon restore](https://neon.com/blog/announcing-point-in-time-restore), [Neon protected branches](https://neon.com/docs/guides/protected-branches), and [Neon current restore defaults](https://neon.com/docs/changelog/2025-10-17). | Data owner |
| File recovery | Original Files are recoverable | Keep a daily encrypted object manifest with size, type, hash, owner, and object key. Before public production, copy original bytes to a separate controlled backup location or document and approve the risk that Filebase Free is only the primary copy. A monthly drill restores a Markdown and a PDF and verifies owner checks. | File owner |
| Observability | Operators can detect and explain failure without student content | Sentry uses the immutable Git SHA as the release id, with separate preview and production environments, source maps uploaded before traffic, and alerts. Keep `.map` files off the public origin after upload. `sendDefaultPii`, AI `recordInputs`, and AI `recordOutputs` stay off. Enable server-side scrubbing and sensitive-field rules explicitly. `beforeSend` removes request bodies, auth headers, query strings, File names, raw prompts, model output, and note content; User ids are one-way pseudonyms if needed. Server logs use structured fields: request id, operation id, route, status, latency, error category, release, and provider request id. See [Sentry data scrubbing](https://docs.sentry.io/security-legal-pii/scrubbing/protecting-user-privacy/), [source maps](https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/), [Sentry AI input/output capture](https://docs.sentry.io/platforms/javascript/guides/koa/configuration/integrations/vercelai/), and [release health](https://docs.sentry.io/product/releases/). | Operations owner |
| Availability alerts | A human can act before a release harms users | Alert on 5xx > 2% for five minutes, auth failure > 5% for five minutes, generation failure > 10% for 15 minutes, p95 read latency > 1s for 10 minutes, backup or cleanup failure, and provider quota at 80%. A P0 is acknowledged within 15 minutes, mitigated or rolled back within 30 minutes, and reviewed within two working days. | Operations owner |
| Release safety | Every production change has a known rollback | CI must pass before merge. Pin `engines.node` to Node 24 and set an explicit Vercel function `maxDuration` below the provider maximum. The preview deploy runs database migrations against an isolated Neon branch and completes the authenticated smoke flow. Production migrations use expand/contract steps and are forward-compatible with the previous deployment. Back up before a destructive migration. A failed release uses Vercel rollback or promotes a known-good deployment; rollback changes traffic only, not database state, environment variables, or external provider state, so schema and provider changes need their own recovery steps. See [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration), and [Vercel rollback](https://vercel.com/docs/deployments/rollback-production-deployment). | Release owner |

## P1 gates

P1 gates do not block a private beta only when the release record names an owner and a date no later than the next public release. They block public production.

- Run a full OWASP ASVS 5.0 review, dependency update review, and secret rotation drill at least every 30 days.
- Run an external or independent security review of authentication, ownership, file access, generated Actions, export, and deletion before public launch.
- Measure field Core Web Vitals for at least seven days of preview traffic, split by mobile and desktop, rather than relying only on lab runs.
- Test restore after a schema migration and after a Filebase object deletion failure.
- Verify the Clerk, Neon, Filebase, OpenCode Go, Vercel, and Sentry terms, regions, limits, and retention statements against their current official pages.
- Complete a privacy review of the User-facing policy, deletion wording, provider disclosure, backup retention, and any India or cross-border data transfer statement. This is an owner approval gate, not an engineering assumption.

## Required test set

The production implementation must add a test runner and keep these tests close to the boundary they protect:

1. **Schema and service tests:** malformed inputs, time zones, recurrence exceptions, version conflicts, idempotent retries, Undo conflicts, foreign ids, deletion tombstones, and export completeness.
2. **Database tests:** two-User isolation at the service and RLS layers; migration up from an empty database; migration up from the previous release; restore into a clean branch.
3. **Model boundary tests:** unknown component, prop, reference, Action, URL, handler, unsafe markup, malformed stream, repair exhaustion, timeout, quota, cancellation, provider 4xx/5xx, and provider response with unexpected fields.
4. **File tests:** extension/content mismatch, bad PDF signature, oversized input, path traversal, object-key collision, private URL expiry, copied URL after expiry, orphan cleanup, delete retry, and export round trip.
5. **Route and browser tests:** sign-in and magic link, onboarding, fresh and saved Canvas, generation and Clarification, direct Action and Undo, every stable route, Focus, File view, export, deletion, reload during each transition, and the desktop/mobile matrix.
6. **Accessibility tests:** automated axe checks, keyboard-only completion of the core process, focus return from dialogs and sheets, screen-reader names and status messages, contrast, zoom, reduced motion, and touch target review.
7. **Operational tests:** Sentry event scrubbing, source-map lookup, alert delivery, provider quota recovery, database restore, object restore, Vercel rollback, and incident runbook timing.

## Release record

Store this record beside the deployment or in the release issue:

```markdown
commit:
environment:
schema_migration:
catalog_version:
prompt_version:
model_id:
model_endpoint_checked_at:
runtime_node_version:
dependency_scan:
typecheck:
build:
unit_and_integration_tests:
browser_and_accessibility_tests:
performance_results:
database_backup_id:
database_restore_drill:
file_backup_manifest:
file_restore_drill:
security_headers_check:
sentry_release_and_alerts:
provider_terms_and_retention_checked_at:
rollback_target:
open_p1_items:
release_owner:
approved_at:
```

The release is blocked when any P0 field is empty, when a P0 threshold fails, when an open P0 incident exists, or when the provider privacy and limit check is older than the release candidate.

## Current gap and handoff

This report defines the bar; it does not claim that the checkout meets it. The next implementation work must establish the real server, database, auth, FileStorage, model gateway, Sentry, test runner, CI, and deployment paths. The following map tickets own the detailed contracts that this bar consumes:

- [Design Kairo account onboarding and lifecycle](https://github.com/xddinside/kairo/issues/5)
- [Research and specify Kairo document ingestion and viewing](https://github.com/xddinside/kairo/issues/12)
- [Prototype production Focus and document-assisted sessions](https://github.com/xddinside/kairo/issues/13)
- [Research and specify notification and reminder behavior](https://github.com/xddinside/kairo/issues/14)
- [Research Kairo model context, agent loop, and production renderer](https://github.com/xddinside/kairo/issues/17)

Those tickets may refine limits inside their own boundary, but they may not remove the P0 ownership, authorization, privacy, recovery, accessibility, responsive, or release gates without a new map decision.

## Sources

Primary sources checked on 2026-08-08:

- [Clerk TanStack React Start quickstart](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart), [session object](https://clerk.com/docs/tanstack-react-start/reference/objects/session), [session tokens](https://clerk.com/docs/guides/sessions/session-tokens), [session options](https://clerk.com/docs/guides/secure/session-options), and [authenticateRequest](https://clerk.com/docs/reference/backend/authenticate-request)
- [TanStack Start hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [branching](https://neon.com/docs/guides/branching-intro), [row-level security](https://neon.com/docs/guides/row-level-security), [pricing and restore window](https://neon.com/pricing), and [point-in-time restore](https://neon.com/blog/announcing-point-in-time-restore)
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations) and [transactions](https://orm.drizzle.team/docs/transactions)
- [Filebase pricing](https://filebase.com/docs/account/pricing), [presigned URLs](https://filebase.com/docs/s3-api/presigned-urls), and [encryption](https://filebase.com/docs/concepts/encryption)
- [OpenCode Go limits and privacy](https://dev.opencode.ai/docs/go/)
- [Vercel deployment environments](https://vercel.com/docs/deployments/overview), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [function duration](https://vercel.com/docs/functions/configuring-functions/duration), [production checklist](https://vercel.com/docs/production-checklist), and [rollback](https://vercel.com/docs/deployments/rollback-production-deployment)
- [Sentry privacy](https://docs.sentry.io/security-legal-pii/scrubbing/protecting-user-privacy/), [organization scrubbing controls](https://docs.sentry.io/api/organizations/update-an-organization/), [TanStack Start source maps](https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/sourcemaps/uploading/esbuild), [AI input/output capture](https://docs.sentry.io/platforms/javascript/guides/koa/configuration/integrations/vercelai/), and [release health](https://docs.sentry.io/product/releases/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Web Vitals](https://web.dev/articles/vitals) and [MDN Baseline](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility)
- [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [secure cookies](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies), [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/), and [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
