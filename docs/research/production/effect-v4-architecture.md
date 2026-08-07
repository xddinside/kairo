# Effect v4 architecture for Kairo

Status: Research. No production code or package pins change in this issue.

Scope: Choose Kairo's idiomatic Effect v4 application model across server and browser, for the stack already decided in Round 2: TanStack Start with Vite and file routes, React 19, Bun locally, Node 24 on Vercel, Clerk, Neon Postgres, Drizzle, a private document-storage service, OpenCode Go as the model provider, Sentry, and responsive web. UploadThing is the proposed storage provider, but its free plan conflicts with Kairo's privacy requirement; section 5.9 records that unresolved choice. This report gives Kairo-specific decisions, exact pins, verified API facts, source evidence, rejected options, and open questions.

Every claim about the `effect` v4 surface was checked against the published `effect@4.0.0-beta.105` package source and the pinned `@effect/*@4.0.0-beta.105` packages, not from memory or from v3 habits.

## 1. Recommendation

Adopt Effect v4 as the application model for Kairo's server and for the shared state on the client, but keep the boundaries Kairo already owns: TanStack Start routes and server functions, Drizzle plus checked-in SQL migrations, Clerk identity, and the bounded generated-view and server-authorized command model from issue #6.

- Effect Schema, Services, Layers, typed errors, Config/Redacted, Schedule, Stream, Queue/PubSub, Cache, and `effect/testing` become Kairo's working vocabulary for backend logic and tests.
- Drizzle stays the single schema, query, and migration authority. Effect does not replace it in v1; see section 6.
- TanStack Start stays the single public transport. Effect RPC and HttpApi are not adopted for the client boundary; see section 7.
- OpenCode Go is reached through a small Effect HttpClient plus provider-stream adapter behind Kairo's `ModelGateway`. Effect AI is a later option, not a v1 dependency; see section 8.
- `effect/unstable/reactivity` (Atom) plus `@effect/atom-react` own Canvas, Focus, clarification, view-history, and stream-transition state on the client; React local state and TanStack route state stay for what they are better at; see section 9.

The prior intent in Round 1 ("use Effect Schema for Kairo-owned domain data and `@effect/atom-react` for suitable React state") survives, but with corrections found during research: `@effect/atom` is not a package, Atom lives in `effect/unstable/reactivity`, and the v4 error API is `Schema.TaggedError<Self>()("Tag", { ... })`, not v3's `Schema.TaggedErrorClass`.

### Version policy

`effect` is a beta. `latest` on npm is 3.22.1; `4.0.0-beta.105` is the current `beta` dist-tag. Kairo pins `4.0.0-beta.105` exactly for `effect` and every `@effect/*` companion, and treats the v4 beta as one upgradeable unit. Rules:

1. All pins are exact (no `^`, no ranges). Companion packages must share the same beta version; mismatched betas break types.
2. A beta upgrade gate runs weekly: `npm view effect dist-tags` must still report the pinned beta, and the configured OpenCode Go model and `/v1/models` response must still match (issue #6 requirement). Upgrade betas as a single batch and run the full `effect`-relevant test suite before merging.
3. Code that imports from `effect/unstable/*` is marked with a `// unstable:` comment and isolated behind Kairo-owned modules so a renamed export touches one file, not the app.
4. Kairo stays on the v4 beta deliberately. Do not fall back to 3.22.1; v3 and v4 module paths differ and mixing them creates a second Effect runtime.

## 2. Use now / Use when needed / Do not use matrix

| Area | Decision | Kairo workflow it serves |
| --- | --- | --- |
| Effect Schema domain values | Use now | Tasks, timetable, deadlines, notes, generated-view specs, transition events, command payloads, provider responses |
| Schema typed errors (`Schema.TaggedError`) | Use now | Clarification, generation failure, command rejection, rate limit, document validation |
| Services, Layers, `Effect.fn` | Use now | All backend business logic; see module tree |
| Config + Redacted | Use now | Neon URL/password, Clerk key, OpenCode Go key, file-storage credentials, provider config |
| Schedule | Use now | Retry/backoff on generation, reminder check cadence, rate-limit pacing |
| Stream | Use now | Generated-view transition events, background reminder checks, DB row streams if later needed |
| Queue/PubSub | Use when needed | Per-Canvas broadcast of transition events to multiple browser tabs; not needed for single-tab v1 |
| SubscriptionRef | Use when needed | Server-side live state, e.g. an active Focus session the server must observe |
| Cache | Use when needed | Rate-limit bookkeeping and dedupe of concurrent identical generation requests |
| RequestResolver | Use when needed | Batch lookups only if Kairo gains a real batch endpoint; none exists in v1 |
| `effect/testing` (TestClock, TestConsole, TestSchema) | Use now | Deterministic tests for generation timing, reminders, retries |
| `effect/unstable/http` HttpClient | Use now | OpenCode Go and HTTP-based provider adapters |
| `@effect/opentelemetry` | Use now | Effect spans and metrics; the production Sentry/OTel bridge stays an ops decision |
| `effect/unstable/sql` (`@effect/sql-pg`) | Do not use for v1 | Kept out to preserve Drizzle as single DB authority; revisit section 6 |
| `effect/unstable/rpc`, `httpapi` | Do not use | Would add a second public transport beside TanStack Start |
| `effect/unstable/ai` | Do not use for v1 | Transport-level adapter is safer against a moving unstable API; revisit |
| `effect/unstable/workflow`, `workers`, `cluster`, `persistence` | Do not use | Heavier than Kairo's needs; Vercel functions + outbox cover reminders |
| `effect/unstable/cli` | Do not use | Kairo has no CLI surface |
| `@effect/atom-react` | Use now | Canvas, Focus, clarification, view history, stream transitions |
| `@effect/platform-node` | Use when needed | Node child-process or platform-specific layers; not a v1 pin |

## 3. Exact compatible pins (verified from npm, 2026-08-07)

### Install in v1

| Package | Pin | Reason |
| --- | --- | --- |
| `effect` | `4.0.0-beta.105` | Core. `latest` is 3.22.1; `beta` is 4.0.0-beta.105 |
| `@effect/opentelemetry` | `4.0.0-beta.105` | NodeSdk, OtelTracer, OtelMetrics, OtelLogger |
| `@effect/atom-react` | `4.0.0-beta.105` | React bindings for Atom; peers `react >=19.2.7 <20`, `scheduler >=0.27.0 <0.28`, `effect ^4.0.0-beta.105` |
| `scheduler` | `0.27.0` | Exact peer for `@effect/atom-react`; Kairo already pins React 19.2.8 |

Kairo's existing React 19.2.8 pin satisfies `@effect/atom-react`. Every pin is exact; Effect companion packages must share the same beta version, and mismatched betas break types. The OpenTelemetry packages are optional peers of `@effect/opentelemetry`; issue #11 must pin only the Node peers required by the Sentry or collector bridge it verifies.

### Hold for re-evaluation, do not install in v1

| Package | Pin if later needed | Reason |
| --- | --- | --- |
| `@effect/sql-pg` | `4.0.0-beta.105` | Postgres adapter for Effect SQL; rejected in v1 per section 6, install only if that decision is reversed |
| `@effect/platform-node` | `4.0.0-beta.105` | Node child-process and platform layers; no v1 workflow needs them |

Do not install these: they do not exist at beta.105, and their functionality moved into `effect`:

- `@effect/atom` — not a package. Atom is `effect/unstable/reactivity/Atom`.
- `@effect/platform`, `@effect/rpc`, `@effect/cli`, `@effect/experimental`, `@effect/data-loader`, `@effect/cluster` — no beta.105 version. Platform, RPC, CLI, workflow, workers, cluster, persistence now live under `effect/unstable/*`.
- `@effect/sql-drizzle` — latest is 0.51.0 (v3-era API). No v4 beta exists.

The `effect` package's export map (from its package.json at beta.105) exposes `.`, `./testing`, and the `./unstable/*` subpaths. Everything Kairo needs for HttpClient, SSE, SQL, AI, RPC, reactivity, observability, process, and encoding is under `./unstable/*`, which is why the instability rule in section 1 matters.

## 4. API stability table

Verified against the package's own `@since` annotations and module paths.

| Module | Path | Status |
| --- | --- | --- |
| Schema, Effect, Stream, Config, Context, Layer, Runtime, Schedule, Cache, Queue, PubSub, SubscriptionRef, Redacted, Data, Result, Tracer, Metric, Logger, DateTime, Cron, Pool, Semaphore, FiberSet, FiberMap | `effect` | Core v4 surface rather than `unstable/*`; the package itself is still beta |
| TestClock, TestConsole, TestSchema, FastCheck | `effect/testing` | Test-only beta surface |
| HttpClient, HttpClientError, HttpServer, HttpServerResponse, FetchHttpClient, Headers, Cookies, Etag, Url, Multipart, HttpRouter, HttpMiddleware | `effect/unstable/http` | Unstable |
| Sse, Ndjson, Yaml, Toml, Msgpack, Ini | `effect/unstable/encoding` | Unstable |
| SqlClient, SqlConnection, SqlError, SqlSchema, SqlResolver, SqlStream, Statement, Migrator | `effect/unstable/sql` | Unstable |
| Atom, AtomRef, AtomRegistry, AtomRpc, AtomHttpApi, Reactivity, AsyncResult, Hydration | `effect/unstable/reactivity` | Unstable |
| Rpc, RpcClient, RpcServer, RpcSchema, RpcSerialization, RpcTest | `effect/unstable/rpc` | Unstable |
| Chat, LanguageModel, Model, Tool, Toolkit, Response, Prompt, Telemetry, EmbeddingModel, OpenAiStructuredOutput, McpServer | `effect/unstable/ai` | Unstable |
| Otlp, OtlpExporter, OtlpTracer, OtlpMetrics, OtlpLogger, PrometheusMetrics | `effect/unstable/observability` | Unstable |
| HttpApi, HttpApiBuilder, HttpApiClient, HttpApiError, HttpApiSecurity, HttpApiSwagger, OpenApi | `effect/unstable/httpapi` | Unstable |
| Workflow, Workers, Cluster, Persistence, Process, Socket, CLI, Devtools, EventLog | `effect/unstable/*` | Unstable |

Naming facts confirmed in beta.105 source that differ from v3 habits:

- `Either` is renamed `Result` in the main index.
- `Schema.TaggedErrorClass` does not exist. The current form is a curried tagged class factory, documented in `dist/Schema.d.ts`: `class NotFound extends Schema.TaggedError<NotFound>()("NotFound", { id: Schema.Number }) {}`.
- `Context.Service` has two forms: function-style `Context.Service<Shape>("Id")` (one call) and class-style `Context.Service<Self, Shape>()("Id")`. `@effect/sql-pg` uses the one-call form; opencode uses the class form. Either is fine; pick one per codebase.
- `FetchHttpClient` is a layer (`FetchHttpClient.layer`), and `HttpClient` typed errors are tagged `HttpClientError` variants: `TransportError`, `EncodeError`, `InvalidUrlError`, `StatusCodeError`, `DecodeError` (confirmed in `dist/unstable/http/HttpClientError.d.ts`). These are exactly the errors to retry or map in the OpenCode Go adapter.

## 5. Backend architecture

### 5.1 Domain values with Schema

Kairo's domain lives in one `Schema` vocabulary shared by the server and the client. This is the same language as the bounded generated-view format from issue #6: a versioned schema, a bounded component catalog, a validator, and an exhaustive renderer. Zod stays confined to the old JSON Render adapter and is not part of Kairo's domain.

Representation rules for Kairo data:

- Kairo-owned records: `Schema.Struct` plus a same-name `interface`. Live entity references for view history (old views render current shared data) are branded `Schema.String` IDs, not nested copies.
- Scalar IDs and version tags: branded schemas (`Schema.String.pipe(Schema.brand("CanvasId"))`).
- Generated-view specs and transition events: tagged unions with `Schema.TaggedUnion` and `.match` for exhaustive rendering. This mirrors opencode's v4 style (`Schema.Struct(...).annotate({ identifier: "..." })`, `Schema.Literal` unions in `packages/schema/src/provider.ts`).
- Boundary crossing: `Schema.decodeUnknownEffect` for untrusted payloads (model output, browser requests). Throw-free `schema.make(...)` only for trusted construction; no casts.

The generated-view spec keeps: schema version, catalog version, model and prompt versions, entity references, and a strict final union of `clarification` or `ready` (issue #6). Schema validates the model's proposed commands at the server boundary before any write.

### 5.2 Typed errors

Use the verified v4 form:

```ts
class GenerationFailed extends Schema.TaggedError<GenerationFailed>()("GenerationFailed", {
  code: Schema.Literal("provider", "rate_limit", "quota", "timeout", "validation"),
  model: Schema.String,
}) {}
```

Typed errors carry the state a boundary can truthfully act on, so the catch at that boundary stays small:

- `RateLimitReached` → surfacing to the student with the limit-recovery state from issue #6.
- `QuotaExceeded` → distinct from `RateLimitReached`; maps to per-user generation quota, not provider limit.
- `ValidationFailed` → catalog/policy failure, never retried.
- `CommandRejected` → idempotency or ownership failure, never retried.
- `TransientProvider` → the only error allowed to retry (section 5.13).

Cause-level recovery is used only at the final Vercel boundary (logging + Sentry), never inside business logic where a typed error exists.

### 5.3 Services and layers

Kairo backend services follow the module = `Service` + `Layer` pattern with `Effect.fn("Module.operation")` for public and non-trivial methods. Service tags use one consistent form across the codebase (prefer the one-call `Context.Service<Shape>("Module")`, matching `@effect/sql-pg`; the class form is equivalent).

```ts
const Database = Context.Service<Database>("Kairo/Database")
const ModelGateway = Context.Service<ModelGateway>("Kairo/ModelGateway")
const Quota = Context.Service<Quota>("Kairo/Quota")

const KairoLive = Layer.provide(
  Layer.merge(
    Database.Live,
    ModelGateway.Live,
    Quota.Live,
    // ... one layer per service
  ),
  ...
)
```

Layers are built with `Layer.effect(Service, Effect.gen(...))` and, where a resource truly needs release, `Effect.acquireRelease` inside its owning long-lived layer. Stateless SDK clients do not gain fake cleanup work. Do not `Layer.mergeAll` blindly; compose only what each runtime actually needs (see 5.5).

### 5.4 Config and Redacted

All secrets read through `Config` in layers: `Config.redacted("NEON_POOL_URL")`, `Config.redacted("CLERK_SECRET_KEY")`, `Config.redacted("OPENCODE_GO_KEY")`, and the selected file provider's key, plus `Config` for model id, base URL, and limits. `Redacted` is the type for secrets end to end; `@effect/sql-pg` itself takes `url`/`password` as `Redacted.Redacted`. `process.env` is never read directly in application logic. Tests override with a `ConfigProvider` (or `ConfigProvider.fromJson`), which keeps test runs deterministic and secret-free.

### 5.5 Runtime and scope lifecycle on Vercel

TanStack Start server functions run on Vercel Node 24 functions. The shape:

- A managed runtime is created once per warm module instance, not per request. Server functions are thin: they decode the browser payload with Schema, call one Effect, and map typed errors to the response.
- `Effect.runPromise` (or the runtime's `runPromise`) is the bridge from the TanStack Start handler into Effect. Because Vercel functions are short-lived and interrupted on response end, long-running generation must stream (5.11) rather than wait.
- Shared clients and any connection pool live in the module runtime layer and may be reused while a Vercel instance stays warm. Do not build and close them on every request. Per-request scope carries only identity, cancellation, spans, and transaction resources. Vercel may reap an instance without a graceful finalizer, so correctness must not depend on process-shutdown cleanup. The Neon pooled connection string is used for the app with a non-owner runtime role; a direct connection URL is used only for migrations (issue #8 addendum).
- Cancellation: fiber interruption propagates when a client disconnects mid-stream. The TanStack stream bridge observes the request abort signal and interrupts the generation fiber, which also stops any in-flight provider request.
- Cold starts: keep layer construction cheap, avoid per-request client recreation, and keep production Neon warm when measured resume latency harms Canvas. Driver choice and pool sizing must match Vercel's instance model; do not open an unbounded process-local pool.

### 5.6 Server boundary: TanStack Start server functions

TanStack Start server functions are Kairo's public transport (issue #8). Each server function:

1. Verifies Clerk auth (`clerkClient` + the token from the request).
2. Decodes the input with `Schema.decodeUnknownEffect`.
3. Calls one Effect service method with the verified user in the context.
4. Maps typed errors to a small error union the client already knows.

A generation call is a server function returning a stream (section 5.11); an action is a server function returning a command result. No browser code reaches the database, provider, or files directly.

### 5.7 Clerk request context

The verified Clerk user id becomes part of the Effect context for the duration of the request. Two layers of enforcement:

- The Effect context carries `ClerkUser` (a branded `Schema.String`), so service methods receive identity as a value and cannot be called without it.
- The database enforces it again: the Clerk user id is set as parameterized transaction-local context (`select set_config('app.current_user_id', $1, true)`) and every private table has an RLS policy on `owner_id` (issue #8 addendum). Server functions verify Clerk before anything else; cross-user denial is tested at both the server and database layers.

`ClerkUser` is never a `Context.Reference` default; it is always provided per request from the verified session.

### 5.8 Neon Postgres through Drizzle

The full comparison is in section 6. Decision: Drizzle owns schema, queries, and migrations; the Drizzle client is provided through a Kairo `Database` service so Effect orchestrates transactions and decoding at the service layer. Row-level safety:

- Migrations: `drizzle-kit generate` produces reviewed, checked-in SQL run against a direct Neon URL with the owner role (issue #8 addendum).
- App runtime: Drizzle client on the pooled URL with a non-owner role; parameterized `set_config(..., true)` inside transactions so RLS sees identity without interpolating SQL.
- Queries that cross ownership are impossible: the `Database` service always applies `owner_id` from the request `ClerkUser`, and RLS denies anyway.

### 5.9 UploadThing and file storage

Kairo stores private Markdown and PDF originals. UploadThing's Free plan (2 GB App) does not include private files; "Private Files" is a paid feature on the 100 GB App ($10/month) or Usage Based plans, per UploadThing's pricing page. Kairo needs private ACLs and signed URLs, so UploadThing Free is unsuitable for document storage.

Do not silently fall back to S3 or weaken files to `public-read`. Keep storage behind a Kairo `FileStorage` service while the user chooses between paid private UploadThing and another provider with private access on an acceptable plan. The service owns authenticated upload authorization, verified completion callbacks, owner-checked signed view URLs, deletion, and export. The Effect architecture does not depend on which provider wins.

### 5.10 OpenCode Go adapter

Kairo's `ModelGateway` normalizes the provider (issue #6 correction). The adapter:

- Base URL and model are validated runtime config: `https://opencode.ai/zen/go/v1/chat/completions` with `deepseek-v4-flash`, both checked against `/v1/models` during a release check (issue #6 requirement).
- The key lives only on the server as a `Redacted` value and is never exposed to the browser or included in generated-view payloads.
- Requests, inbound provider chunks, usage, and errors are decoded with `Schema` into Kairo contracts (`Sse` decoding from `effect/unstable/encoding`, `HttpClient` from `effect/unstable/http`).
- Provider errors map to the typed error union; `StatusCodeError`, `TransportError`, and malformed-SSE `DecodeError` map to `TransientProvider`; 429 maps to `RateLimitReached`; the value limits ($12/5h, $30/week, $60/month) are surfaced as `QuotaExceeded` with the recovery state from issue #6.
- The OpenCode Go docs list `@ai-sdk/openai-compatible` as the SDK package for this endpoint. Kairo does not adopt the AI SDK in v1; the reason and the tradeoff are in section 8.

Privacy note from the OpenCode Go docs: DeepSeek V4 Flash has zero-day retention under a monthly-renewed ZDR agreement currently valid through August 31, 2026. Recheck that status before sending private student documents or context in production (issue #6 requirement).

### 5.11 Generation stream

Generation follows issue #6's model: stream named transition events, publish a view only after full catalog and policy validation. Provider SSE is decoded inside `ModelGateway`; raw provider deltas never become browser events. `Generation` accumulates the candidate privately, validates it once complete, persists the immutable spec, then emits `ready`. A failure emits a typed recovery transition and stores no history entry.

TanStack Start server functions support typed `ReadableStream` and async-generator results. Use that as Kairo's browser transport so TanStack remains the only public RPC layer. A raw SSE server route is needed only if browser `EventSource` behavior becomes a measured requirement. In both forms, the request abort signal interrupts the Effect fiber. The client consumes only Kairo transition events and never trusts partial provider JSON.

### 5.12 Commands

Actions are server-authorized, idempotent commands (issue #6):

- The browser sends a `CommandEnvelope` (command name, view spec id, record version, nonce, payload), decoded by Schema.
- The server reloads the canonical view from the persisted history, re-validates the payload against the current catalog and policy, and checks the owner and record version.
- The nonce + version make the write idempotent: re-delivery after a retry does not duplicate the effect. Audit and Undo data are written in the same transaction.
- No command repeats after commit; retries only resend idempotent commands.

This is where Effect's transactional control pays: the command write, audit row, and any shared-academic-data change happen in one Drizzle transaction inside one Effect.

### 5.13 Retries, rate limits, idempotency

- Retries: `Effect.retry` with a bounded `Schedule` (exponential backoff with jitter and a cap) only on `TransientProvider`. Validation, quota, and command errors never retry. Provider calls stay outside authoritative database transactions (skill boundary rule, and keeps re-entrancy safe).
- Rate limits: `Ref`/`Cache` may reduce repeated reads, but the database is authoritative. At generation start, reserve quota idempotently by generation request id in a short transaction; call the provider outside that transaction; then settle measured usage in another idempotent write. A cold restart cannot bypass or double-charge the reservation. The provider's own 5h/week/month value limits are monitored separately; `QuotaExceeded` maps to the product's limit-recovery state.
- Timeouts: `Effect.timeout` on the whole generation turn and per provider-network read; the inbound provider stream adapter aborts on timeout (opencode's `aisdk.ts` shows the same read-timeout pattern in production).
- Idempotency: command nonce + view record version, written durably before any retry path.

### 5.14 Monitoring

- `@effect/opentelemetry` supplies Effect tracing and metrics. The production quality issue must choose and verify the Sentry bridge or OTLP collector path rather than assuming direct export. Every generation turn gets a span with request id, model, latency, usage, retries, validation code, and action outcome, without logging private student text (issue #6).
- Sentry SDK remains for browser errors and crash reports; Effect errors that cross the boundary are reported with their typed cause.
- Vercel logs for operations; a release check verifies the configured provider model against `/v1/models` and the current OpenCode Go limits.

### 5.15 Tests

- `effect/testing` with `TestClock` for anything time-based: reminder scheduling, retry backoff, quota windows, timeout behavior. No `Effect.sleep` in tests.
- Deterministic synchronization with `Deferred`, `Queue`, `Latch`, or `Ref` instead of sleeps.
- Layers provide fakes: a `FakeModelGateway` that emits scripted transition events or fails with each typed error, a service-level `FakeDatabase` for unit tests, and a test `ConfigProvider` for secrets. Transaction and RLS integration tests run against a disposable real Postgres or Neon preview branch rather than pretending an in-memory database has PostgreSQL behavior.
- Cross-user denial tested at both the server layer (service called with another `ClerkUser`) and the database layer (RLS policy rejects the same query).
- Schema round-trips: `schema.decodeUnknownEffect` then re-encode for every generated-view spec and transition event; catalog exhaustiveness enforced by `TaggedUnion.match` returning `never` when a case is missed.

## 6. Drizzle versus Effect SQL

Effect SQL v4 exists and is source-verified: `effect/unstable/sql` (SqlClient, SqlSchema, SqlResolver, SqlStream, Statement, Migrator) plus the `@effect/sql-pg` adapter with typed `SqlError` variants (`ConnectionError`, `ConstraintError`, `UniqueViolation`, `DeadlockError`, `SerializationError`, `LockTimeoutError`, `StatementTimeoutError`, and friends), `withTransaction`, savepoint nested transactions, `reactive` queries, and `listen`/`notify`. It is attractive: typed row decoding into Kairo's Schema vocabulary, typed retry on connection/serialization errors, and one language across domain and rows.

Kairo's decision: keep Drizzle as the single schema, query, and migration authority for v1, and do not add Effect SQL as a runtime query language. Reasons, in order:

1. Single authority. The acceptance bar for this issue is no second schema, migration, or query source of truth. Running both Drizzle query building and Effect SQL tagged statements is two query authorities over the same rows. opencode only makes this work by building its own bridge (`@opencode-ai/effect-drizzle-sqlite`) so Drizzle still owns the queries; no published v4 bridge for Postgres exists (the v3 `@effect/sql-drizzle` package tops out at 0.51.0 and has no beta.105 version).
2. Effect SQL is `unstable`. Adopting it now puts Kairo's persistence on the most unstable surface of an already-beta library, while Drizzle's migration and query tools are stable and already decided (issue #8).
3. Kairo's gains from Effect SQL are mostly recoverable at the service boundary. Typed row decoding is replaced by Drizzle's typed result rows plus a `Schema.decodeUnknownEffect` step inside the `Database` service when a row crosses into domain code. Typed retry still applies at the Effect service layer by mapping Drizzle errors to Kairo's typed errors.

The narrow seam: Kairo's `Database` service owns every Drizzle client access, transaction, and row-to-domain decode. That one module is where Effect SQL could later replace Drizzle without touching services above it. If Kairo later needs reactive DB streams (`SqlClient.reactive`) or `SqlStream` for large row sets, re-evaluate at that point with the then-current `effect/unstable/sql` API; do not adopt it now.

Migrations stay Drizzle-generated, reviewed, checked-in SQL, run with a direct connection URL and owner role (issue #8 addendum). The app uses the pooled URL with a non-owner role and parameterized transaction-local `set_config` for RLS.

## 7. Effect RPC versus TanStack Start

Kairo already decided TanStack Start server functions as the authenticated server boundary (issue #8). Effect v4 ships a complete schema-driven RPC and HTTP API stack (`effect/unstable/rpc`: Rpc, RpcClient, RpcServer with typed errors and streaming; `effect/unstable/httpapi`: HttpApi, HttpApiBuilder, HttpApiClient, HttpApiError, HttpApiSecurity, OpenApi). opencode runs its server on exactly this (`HttpApiBuilder.group` in `packages/server/src/handlers/*`), and it is production-proven there.

Kairo does not adopt it for the public boundary. Adding RPC/HttpApi alongside TanStack Start creates two routing, transport, and error-shaping systems for the same client-server traffic. TanStack Start already provides the route model, server functions, and streaming integration Kairo needs; the generated-view streaming and commands are served by server functions without a second layer.

Reuse without a second system: server functions stay thin decoders into Effect services, so the domain never learns about TanStack. If Kairo later needs a machine-facing API (a webhook for an email provider, or a public status endpoint), revisit HttpApi then; it is a candidate for a *new* surface, not a replacement for the existing one.

## 8. Effect AI versus an HttpClient adapter

Effect AI v4 (`effect/unstable/ai`) is source-verified: `LanguageModel.make({ generateText, streamText })` is a provider protocol that Kairo could implement over OpenCode Go, with `Chat`, `Tool`/`Toolkit`, structured-output transforms (`OpenAiStructuredOutput`), `Response` part types, and `Telemetry`. Its value is the higher-level language: tools, structured output, and usage in one vocabulary.

Decision for v1: do not depend on `effect/unstable/ai` for the OpenCode Go transport. Use a small Effect HttpClient plus provider-stream adapter behind `ModelGateway`, because:

1. It is the most unstable module in an already-beta library, and issue #6 already demanded Kairo normalize provider responses into its own contracts. The adapter boundary exists regardless.
2. `effect/unstable/ai` expects a provider implementation as raw `generateText`/`streamText` over a `Response.PartEncoded` wire format that is itself unstable. Kairo's model output is not free text: it must produce a bounded candidate view spec, tool-shaped command proposals, and transition events. `ModelGateway` will own that mapping either way.
3. The current production pattern in this exact domain is a thin transport: opencode wraps the AI SDK provider transport and adds its own SSE read-timeout and abort handling (`packages/core/src/aisdk.ts`), rather than depending on Effect AI for transport. The OpenCode Go docs list `@ai-sdk/openai-compatible` as the SDK for the endpoint, which is the same "thin transport" philosophy, not Effect AI.

Future option: if Kairo later wants generic tool-calling and structured-output ergonomics beyond the bounded catalog, revisit `effect/unstable/ai` as the vocabulary *above* `ModelGateway`. Keep the gateway as the only place that speaks OpenAI-compatible wire format, so this remains a swap, not a rewrite. Current fact: `effect/unstable/ai` exists at beta.105 but has no built-in OpenAI-compatible chat-completions client; implement the transport or bring your own.

## 9. Frontend: Atom, and where React and TanStack stay better

`effect/unstable/reactivity` exports `Atom`, `AtomRef`, `AtomRegistry`, `Hydration`, `Reactivity`, and `AsyncResult`; `@effect/atom-react` (peer: React >= 19.2.7) provides `RegistryProvider` and hooks `useAtom`, `useAtomValue`, `useAtomSet`, `useAtomSuspense`, `useAtomSubscribe`, `useAtomRef`, `useAtomInitialValues`. Atom is the shared, single-writer reactive state with `Atom.get/set/update` inside `Effect` and subscription from React.

Kairo client state split:

Use Atom + `@effect/atom-react` for:

- **Active Focus session state**, shared between Canvas and the stable Focus route so neither forces navigation (production decision). One `Atom` holding the session is the single writer; both surfaces read it.
- **Canvas state**: current view index, pending transition state, the clarification panel (position count, preserved answers), and which generated view is active. These cross component boundaries inside Canvas and outlive a single render.
- **Generated-view history index** for the open Canvas: the loaded history, current index, and prev/next position. The immutable specs themselves come from the server; the Atom holds the working set and cursor.
- **Streamed transition state**: `transitioning` / `clarifying` / `ready` as an `Atom<AsyncResult<Transition, StreamError>>`, driven by the typed transition stream; `useAtomSuspense` or `useAtom` renders the states and prevents mid-stream jank.
- **Optimistic command state**: the pending command (nonce, target view, expected version) as an `Atom`, reconciled by the server's idempotent result.

Keep React local state for:

- One-component, non-shared UI: whether a menu is open, a text field value, hover state, animation toggles.
- Pure derived values computed during render from an Atom read.

Keep TanStack Router/Start state for:

- URL-driven state: current route, search params, the saved Canvas address. Reloading a saved Canvas must keep the student in it (production decision); that is route state, not Atom state.
- Server-loaded route data (`createServerFn` / route loaders): the initial snapshot of shared academic data and canvas list. Server data flows into Atoms at hydration, then Atoms own mutations and optimistic updates.

Rules: never wrap a one-line pure function or a single-component `useState` in an Atom. Atoms hold state that is shared, multi-writer (over time, not per event), or transition-driven. React state stays the default for anything local.

Hydration: `useAtomInitialValues` plus `RegistryProvider` bridge server data into the registry; the stream adapter writes `transition` events into the Atom so React re-renders at the correct granularity. No browser code ever touches the provider or private storage directly; server functions are the only path.

## 10. Concurrency and time modules mapped to Kairo workflows

- **Stream**: generation transition events (5.11); background reminder checks enumerated as a stream of due items; future: streaming DB rows via `SqlStream` only if Effect SQL is revisited.
- **Queue / PubSub**: per-Canvas `PubSub` of transition events when more than one tab must observe the same generation (out of scope for v1 single-tab; kept as the designated replacement for polling). `Queue` for a producer/consumer split inside the provider-stream adapter when one is needed.
- **SubscriptionRef**: server-side latest value that must be observable, e.g. an active Focus session the server tracks; do not use for data the client already owns.
- **Schedule**: retry/backoff on generation (bounded, jittered); reminder cadence; quota-window pacing; timeout enforcement. All under `TestClock` in tests.
- **Cache**: per-user rate-limit bookkeeping and dedupe of concurrent identical generation requests (same nonce + version in flight returns the same result instead of double billing).
- **RequestResolver**: only if a real batch endpoint appears (e.g. batch view-history fetch); none exists in v1, so do not add the machinery.
- **HttpClient (effect/unstable/http)**: OpenCode Go and HTTP-based provider adapters. Use a provider's official SDK behind an Effect service when it gives safer signature or callback handling. `HttpClient.retryTransient` plus the typed `HttpClientError` variants are the retry surface for direct HTTP.
- **Tracing / OTel / Sentry**: section 5.14. Spans are `Effect.fn`-named operations; the quality issue verifies the final Sentry/OTel bridge.
- **Browser notifications**: notification permission and OS delivery stay in a browser-side `Notifications` module that consumes reminder Atom/stream events; the server only produces the reminder event stream. Email/mobile push are not in scope for v1 (production decision).
- **Reminder workers**: Vercel Cron triggers an authenticated server function that reads due reminders, applies the idempotent outbox, and produces events. No long-lived worker process; `effect/unstable/workflow` and `workers` are rejected as heavier than needed.
- **Cancellation and backpressure**: stream backpressure flows from `Stream` pull semantics into the TanStack `ReadableStream` or async-generator bridge; client disconnect aborts the generation fiber. The inbound provider SSE decoder and outbound app stream each have bounded buffering and separate tests.
- **Deterministic tests**: `effect/testing` TestClock for time, `Deferred`/`Latch`/`Queue` for synchronization, fake layers for model, database, and config (5.15).

## 11. Module tree and runtime composition

Proposed server layout (no code changes in this issue; shape only):

```
src/server/
  domain/            # Schema types, brands, tagged unions
    canvas.ts
    task.ts, timetable.ts, deadline.ts, note.ts, focus.ts
    generated-view.ts   # versioned spec + catalog schema + validator
    transition.ts       # transition event union
    command.ts          # CommandEnvelope, nonce, record version
    errors.ts           # Schema.TaggedError classes (section 5.2)
  services/          # Service + Layer modules
    database.ts         # Drizzle client, transactions, RLS context (single seam)
    quota.ts            # per-user generation quota
    model-gateway.ts    # OpenCode Go adapter (schema-decoded, section 5.10)
    generation.ts       # stream pipeline + validation (5.11)
    commands.ts         # authorize, reload, validate, write idempotently (5.12)
    canvas.ts, academic-data.ts, focus.ts, reminders.ts, documents.ts
    clerk.ts            # ClerkUser context + verification layer
    files.ts            # private provider behind FileStorage boundary
  http/
    routes/             # TanStack Start routes
    server-functions.ts # thin decoders -> Effect services (5.6)
    stream.ts           # Effect Stream -> TanStack typed stream bridge
  runtime.ts          # makeRuntime, request edge layers (5.5)
  config.ts           # Config + Redacted recipes (5.4)
  tests/              # TestClock, fake layers (5.15)
```

Browser:

```
src/client/
  state/            # Atoms + registry wiring (section 9)
    canvas.ts, focus.ts, clarification.ts, transition.ts, optimistic.ts
  components/       # React components reading Atoms via @effect/atom-react
  stream.ts         # typed transition stream -> transition Atom
  notifications.ts  # permission + OS delivery
```

Runtime composition shape:

- `runtime.ts` builds one managed runtime with the live layers and a `ConfigProvider` reading the environment. The runtime and shared clients are module-lifetime, not per-request.
- Server functions run `Effect` with the base runtime plus per-request identity, span, cancellation, and scope. Database transactions and request-owned streams are scoped to the call; reusable clients are not rebuilt or closed for each request.

## 12. Staged adoption plan

1. **Foundation**: pin `effect@4.0.0-beta.105` and companions; add `runtime.ts`, `config.ts`, `errors.ts`, and the `Database` service seam. No product behavior changes.
2. **Domain types**: move shared academic data and generated-view spec to Schema; keep Drizzle rows decoding through the `Database` service. Validation round-trip tests.
3. **Services**: port command execution and generation orchestration to Effect services with typed errors, `Effect.fn`, Schedule retry, timeouts, and TestClock tests. Server functions stay thin.
4. **Model gateway**: implement `ModelGateway` with HttpClient + SSE against OpenCode Go; map errors and usage; add quota.
5. **Streaming**: transition-event stream through the TanStack stream bridge; client subscribes.
6. **Client state**: introduce Atom registry; move Canvas, Focus, clarification, and optimistic state to Atoms via `@effect/atom-react`.
7. **Observability and ops**: OTel + Sentry export, release check for model/limits, quotas, and outbox reminders.
8. **Stabilize**: upgrade gate runs each beta bump; revisit `effect/unstable/sql` and `effect/unstable/ai` with the then-current APIs only if a concrete Kairo need appears.

## 13. Risks

- **Beta drift**: the biggest risk. Mitigated by exact pins, batch upgrades, the weekly gate, and isolating `unstable` imports behind Kairo modules.
- **Beta and `unstable/*` API churn**: HttpClient, SSE, and reactivity live under `unstable` in v4; `@effect/opentelemetry` is a matching beta companion. The adapter seams (gateway, stream bridge, atom wiring, tracing) are the only files that touch them.
- **Atom/reactivity maturity**: `effect/unstable/reactivity` and `@effect/atom-react` are new. Keep the registry small, keep pure-value state in React, and keep Atoms the only place stream events write.
- **Two authority temptation**: Drizzle and TanStack Start already own their seams; the risk is someone adding Effect SQL or HttpApi "because opencode does." The report's rejected-pattern list is the guardrail.
- **Provider change**: OpenCode Go limits, model list, and ZDR status can change (issue #6). `ModelGateway` + release check absorb this.
- **Streaming over server functions**: correctness on Vercel depends on the abort/backpressure bridge. Test disconnect and timeout paths explicitly; use a raw SSE server route only if `EventSource` becomes necessary.
- **RLS with transaction-local context**: transaction-local `set_config(..., true)` requires every private query to run inside the identity transaction; a query outside one loses identity. Enforce via the `Database` service, not convention.

## 14. Rejected patterns

- **Effect SQL as a second query language** (section 6): two query authorities over one schema.
- **Effect RPC or HttpApi as the public boundary** (section 7): a second routing/transport system beside TanStack Start.
- **Effect AI as the provider transport in v1** (section 8): unstable wire format where a thin adapter is safer and already required by issue #6.
- **`@effect/atom`**: does not exist; Atom is in `effect/unstable/reactivity`.
- **Zod for Kairo domain**: stays confined to the old JSON Render adapter (Round 1 decision).
- **`Context.Reference` defaults hiding auth, DB, or provider access**: identity and authority are always provided per request (skill boundary rule, and a security requirement).
- **`Layer.mergeAll` as a blind compose tool**: opencode composes handler layers with it, but Kairo composes the exact runtime each edge needs.
- **Sleep-based or real-time tests**: `TestClock` and synchronization primitives only.
- **UploadThing Free for private documents** (section 5.9), and silently reverting to another provider before the user resolves the cost/privacy choice.

## 15. Verification checklist

- [ ] Exact pins (`4.0.0-beta.105`) for `effect`, `@effect/opentelemetry`, `@effect/atom-react`; React >= 19.2.7. `@effect/sql-pg` and `@effect/platform-node` absent from v1 dependencies.
- [ ] `npm ls effect @effect/*` shows one version; no 3.x anywhere.
- [ ] Every `effect/unstable/*` import is isolated behind a Kairo module with an `// unstable:` comment.
- [ ] All secrets are `Redacted` via `Config`; no `process.env` reads in application logic.
- [ ] Schema round-trip + catalog exhaustiveness tests pass for every generated-view spec and transition event.
- [ ] Command writes are idempotent (nonce + record version) and tested for re-delivery.
- [ ] Cross-user denial tested at server and RLS layers.
- [ ] Generation retries only on `TransientProvider`; timeouts enforced; quota errors map to the product recovery state.
- [ ] Provider decoder and TanStack client-stream bridge tested for abort, disconnect, malformed chunks, and slow consumers.
- [ ] No duplicate schema, migration, transport, state, auth, or AI authority in `src/`.
- [ ] OpenCode Go `/v1/models` release check and current limits documented in runbook.
- [ ] `git status --short` in this worktree shows only this report.

## 16. Evidence

Effect v4 (inspected the npm artifacts and their provenance source commit, `5b6febd5f0ba3f941061fd3aea8a3a853ea617eb`):

- [`effect@4.0.0-beta.105` npm artifact](https://www.npmjs.com/package/effect/v/4.0.0-beta.105) and [published source tree](https://github.com/Effect-TS/effect/tree/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb): npm reports `latest` = 3.22.1 and `beta` = 4.0.0-beta.105; the export map contains `.`, `./testing`, and `./unstable/*`.
- [`Schema.ts`](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/effect/src/Schema.ts) (`Schema.TaggedError<Self>()("Tag", {...})`) and [`Context.ts`](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/effect/src/Context.ts) (`Context.Service` forms).
- [`HttpClientError.ts`](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/effect/src/unstable/http/HttpClientError.ts), [`FetchHttpClient.ts`](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/effect/src/unstable/http/FetchHttpClient.ts), and [`Sse.ts`](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/effect/src/unstable/encoding/Sse.ts) establish the current HTTP error, fetch layer, and inbound SSE surfaces.
- [`SqlClient.ts`](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/effect/src/unstable/sql/SqlClient.ts), [`Migrator.ts`](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/effect/src/unstable/sql/Migrator.ts), and [`@effect/sql-pg`'s `PgClient.ts`](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/sql/pg/src/PgClient.ts) establish the Effect SQL option that section 6 rejects for v1.
- [`Atom.ts`](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/effect/src/unstable/reactivity/Atom.ts), [`@effect/atom-react` hooks](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/atom/react/src/Hooks.ts), [`LanguageModel.ts`](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/effect/src/unstable/ai/LanguageModel.ts), and [`Rpc.ts`](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/effect/src/unstable/rpc/Rpc.ts) establish the frontend, AI, and RPC choices.
- [`@effect/opentelemetry`'s `NodeSdk.ts`](https://github.com/Effect-TS/effect/blob/5b6febd5f0ba3f941061fd3aea8a3a853ea617eb/packages/opentelemetry/src/NodeSdk.ts) establishes the tracing integration. npm registry checks found no beta.105 version for `@effect/atom`, `@effect/platform`, `@effect/rpc`, `@effect/cli`, `@effect/experimental`, `@effect/sentry`, or `@effect/sql-drizzle`.

anomalyco/opencode (commit [`284214c78d32a09fd9c729bdefc07be50f74eb40`](https://github.com/anomalyco/opencode/tree/284214c78d32a09fd9c729bdefc07be50f74eb40)):

- [`handlers/message.ts`](https://github.com/anomalyco/opencode/blob/284214c78d32a09fd9c729bdefc07be50f74eb40/packages/server/src/handlers/message.ts) uses `HttpApiBuilder.group` and `Effect.fn`; [`schema.ts`](https://github.com/anomalyco/opencode/blob/284214c78d32a09fd9c729bdefc07be50f74eb40/packages/schema/src/schema.ts) and [`provider.ts`](https://github.com/anomalyco/opencode/blob/284214c78d32a09fd9c729bdefc07be50f74eb40/packages/schema/src/provider.ts) show current Schema records, brands, annotations, and provider unions.
- [`database.ts`](https://github.com/anomalyco/opencode/blob/284214c78d32a09fd9c729bdefc07be50f74eb40/packages/core/src/database/database.ts) uses a service and layer around an Effect-to-Drizzle bridge, while [`account/sql.ts`](https://github.com/anomalyco/opencode/blob/284214c78d32a09fd9c729bdefc07be50f74eb40/packages/core/src/account/sql.ts) keeps Drizzle as the table authority.
- [`aisdk.ts`](https://github.com/anomalyco/opencode/blob/284214c78d32a09fd9c729bdefc07be50f74eb40/packages/core/src/aisdk.ts) wraps its model transport with explicit SSE read timeout and abort handling.

Official product sources:

- [OpenCode Go](https://dev.opencode.ai/docs/go/) documents `deepseek-v4-flash`, the OpenAI-compatible endpoint, rolling limits, `/v1/models`, and the current privacy status.
- [UploadThing pricing](https://uploadthing.com/) lists the free 2 GB plan and paid private-file plans; [Regions and ACL](https://docs.uploadthing.com/concepts/regions-acl) states that private files and signed URLs require a paid plan.
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) keep Kairo's app transport in Start; [streaming from server functions](https://tanstack.com/start/v0/docs/framework/react/guide/streaming-data-from-server-functions) documents typed `ReadableStream` and async-generator results.
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [Clerk's TanStack Start SDK](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart), and [Drizzle migrations](https://orm.drizzle.team/docs/migrations) support the surrounding database, auth, and migration boundaries.
- Kairo [issue #6](https://github.com/xddinside/kairo/issues/6) records the model and generated-view runtime, [issue #8](https://github.com/xddinside/kairo/issues/8) records the data foundation and later database corrections, and [issue #15](https://github.com/xddinside/kairo/issues/15) scopes this research.

## 17. Open questions for later domain work

- Exact reminder scheduling model (per-task, per-deadline) once the reminder contract is specified in production decisions.
- Private file provider: paid UploadThing versus another provider with private access on an acceptable plan. UploadThing Free cannot satisfy Kairo's document privacy requirement.
- Whether Focus history needs server-side live state (`SubscriptionRef`) once the Focus route redesign lands.
- Batch endpoints (view-history fetch) would justify `RequestResolver`; none exist in v1.
- Re-evaluation date for `effect/unstable/sql` and `effect/unstable/ai` after a few beta bumps.
