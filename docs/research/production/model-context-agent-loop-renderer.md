# Kairo model context, agent loop, and generated-view renderer

Status: resolved for production v1 planning
Research date: 2026-08-08
Map: [Chart Kairo production v1](https://github.com/xddinside/kairo/issues/3)
Question: [Research Kairo model context, agent loop, and production renderer](https://github.com/xddinside/kairo/issues/17)

## Decision

Kairo uses one server-owned ModelRuntime boundary. The runtime builds a deterministic, versioned context envelope, calls OpenCode Go's DeepSeek V4 Flash through a Kairo-owned gateway, and accepts only a strict Kairo result. Model tools are read-only. Every mutation becomes one server-authorized, typed, idempotent Domain command.

The current Canvas view is part of the model context in compact semantic form. It is not sent as browser DOM, HTML, CSS, provider data, or a screenshot. The runtime includes the current selected Generated view and the relevant recent Canvas activity. Older history is fetched only when the model requests it through a bounded read-only tool.

Context construction is deterministic server code, not a second model call. This keeps latency, privacy, and token use stable. The generation model may request more history or related records after it receives the initial context, but only through the approved tool boundary.

Normal token use is shaped by stable prompt sections, canonical ordering, fixed field and excerpt sizes, a bounded catalog, and compact output fields. Input and output ceilings are safety guards, not normal operating targets. The release process measures token use from golden fixtures and tunes target envelopes without changing the domain contract.

## Fixed product boundaries

- One private User owns every Canvas, activity, Generated view, File, and academic record.
- Canvas activities are ordered requests, attachments, Clarification answers, and accepted Actions. Model messages, tool calls, provider payloads, and traces are not Canvas activities.
- A Generated view is a complete, immutable, validated catalog spec. Its approved data references resolve against current User-owned data when it renders.
- A Clarification is a temporary transition. File-inferred facts require confirmation before a write; an explicit student fact may become a Domain command directly.
- A mutating Action is one Domain command. It uses User ownership checks, expected record versions, and an idempotency key.
- The renderer accepts only versioned catalog components, typed props, approved references, and catalog Actions.
- The renderer rejects generated code, HTML, CSS, handlers, arbitrary URLs, arbitrary state paths, and provider objects.
- Quiet Rail, the existing plan components, and the stable product routes remain settled inputs.

## Request and result models

The client sends a serializable request. Client ids help resume or deduplicate work; they never grant access.

~~~ts
type GenerateRequest = {
  canvasId?: CanvasId;
  clientRequestId: string;
  operationId: OperationId;
  requestActivityId: ActivityId;
  text: string;
  fileIds: FileId[];
  sourceViewId?: GeneratedViewId;
};
~~~

The server derives the current User, local timezone, current time, ownership, and canonical records. It writes the request activity before starting the side effect.

~~~ts
type ContextEnvelope = {
  contextVersion: string;
  user: { id: UserId; timezone: string };
  canvas: {
    id: CanvasId;
    state: "active" | "archived";
    selectedViewId?: GeneratedViewId;
    currentView: CurrentViewContext;
    recentActivities: CanvasActivityContext[];
  };
  academic: AcademicContext;
  files: FileContext[];
  focus: FocusContext;
  catalogVersion: string;
  schemaVersion: string;
  promptVersion: string;
  modelId: string;
  policy: RuntimePolicy;
};
~~~

Provider response types stop at the gateway. The rest of Kairo sees this union only:

~~~ts
type RuntimeResult =
  | {
      kind: "view";
      spec: CatalogViewSpec;
      rationale?: string;
      evidence: EvidenceRef[];
    }
  | {
      kind: "clarification";
      questions: ClarificationQuestion[];
    }
  | {
      kind: "action";
      action: CatalogAction;
      args: unknown;
    }
  | {
      kind: "failure";
      category: FailureCategory;
    };
~~~

## Deterministic context construction

The ContextBuilder is a pure, versioned service over authorized data. The same User, Canvas state, request, and runtime versions produce the same section order and the same serialized content.

It assembles context in this order:

1. Runtime policy, model, catalog, schema, and prompt versions.
2. User timezone and current time.
3. Current Canvas id, selected Generated view id, and Canvas state.
4. The current selected Generated view in canonical compact form: component order and types, visible labels and props, approved live references, available Actions, and current values for those references.
5. The recent Canvas activity tail, with the request and the activities needed to resolve the current instruction.
6. Explicitly attached File extraction references and bounded snippets. Storage URLs and object keys never enter the model context.
7. Current User-owned academic records and Focus state selected by typed references or deterministic request matching.

The builder does not send the full Canvas history by default. A read-only History tool can fetch an older Generated view or activity range when the request refers to an earlier state. The tool returns the same canonical, redacted shapes as the initial envelope.

The initial implementation uses stable safety guards:

- request text: 4,000 characters;
- recent activity tail: 12 activities;
- activity text: 1,000 characters per activity;
- File excerpts: at most 5 selected Files and 8,000 characters per File excerpt;
- current view: at most 12 catalog elements after canonical compaction;
- rationale: 600 characters;
- evidence references: 8 entries;
- absolute context safety ceiling: 32,768 input tokens;
- absolute generated-output safety ceiling: 4,096 tokens.

These ceilings protect the service from malformed or adversarial input. They are not the target request size. The target size is established from golden fixtures for base, File-assisted, and history-assisted generation. CI records token counts and fails when a serializer change creates unexplained variance.

The builder does not call a model. It uses typed filters, stable sort keys, fixed serializers, and deterministic truncation. A future context-ranking model would require a new product and privacy decision.

## Bounded runtime state machine

The operation is persisted so a reload or lost response can resume it:

~~~text
accepted
  -> context_built
  -> running
  -> validating
  -> ready
  -> clarifying
  -> action_proposed
  -> repairing
  -> recovering
  -> cancelled
~~~

Only valid transitions are accepted. A terminal product result is one of:

- view_ready;
- clarification_required;
- direct_command_result;
- recoverable_failure; or
- cancelled.

The runtime rules are:

- One generation may run per Canvas.
- At most two generations may run for one User.
- A generation has a 60-second wall timeout.
- The first named transition event should arrive within 2 seconds.
- A run may make at most 8 read-only tool calls.
- A malformed result gets one typed repair attempt. A second validation failure enters recovery.
- One transient retry is allowed for a network failure or provider 5xx. Quota errors, provider 4xx errors, validation errors, and cancellation are not retried automatically.
- A retry after recovery starts a new generation operation against current data.
- A lost generation response resumes the original operation id. A lost command response repeats the original command id and idempotency key.
- Cancellation is best effort. If a view committed before cancellation arrived, the student receives that view; otherwise no history entry is added.

## Provider gateway

The gateway owns provider configuration, request normalization, streaming conversion, usage accounting, cancellation, retries, error mapping, and redaction.

- Configure the model id and endpoint as validated server runtime settings.
- Verify the configured model and the provider model list during deployment.
- Keep the OpenCode Go key on the server.
- Do not expose OpenCode request, response, stream, or error shapes to Canvas, Domain, or renderer code.
- Track the provider's five-hour, weekly, and monthly usage limits and alert at 80% and 100%.
- Enforce Kairo's launch quota of 10 generation operations per User per hour and 50 per day.
- Stop with a clear quota recovery state. Do not use paid Zen balance automatically.
- Recheck provider terms, region, training, retention, model availability, and endpoint status before each production release.

## Catalog and generated-view schema

The current prototype establishes these bounded catalog components:

- WorkPlan;
- ScheduleSnapshot;
- DeadlineSnapshot;
- ContextNotes;
- TaskChecklist;
- FocusSession;
- PlanRationale;
- DecisionPrompt; and
- GeneratedView as the validated envelope.

Every component has a versioned prop schema and an exhaustive React implementation. Every reference is a logical, typed reference:

~~~ts
type DataRef =
  | { kind: "task"; id: TaskId }
  | { kind: "assessment"; id: AssessmentId }
  | { kind: "timetable_entry"; id: TimetableEntryId }
  | { kind: "note"; id: NoteId }
  | { kind: "file"; id: FileId }
  | { kind: "focus_session"; id: FocusSessionId };
~~~

The server resolves and authorizes references at render time. A deleted or unavailable record renders as an unavailable or empty block without rewriting the immutable view.

Catalog Actions include opening a permitted route or record, selecting a Note, shaping a plan, reviewing work, starting or pausing Focus, and marking or reopening a Task. Read-only Actions remain read-only. Mutating Actions become one typed Domain command with expected versions and an idempotency key.

The Generated view may contain a short task-facing rationale. It does not contain a provenance panel. A small Context affordance in the view header exposes the selected records and Files only on hover or keyboard focus. The affordance is optional detail, not part of the main Canvas flow.

## Rendering and JSON Render

Kairo keeps the declarative AST and catalog ideas from JSON Render, but owns the production trust path:

- Keep a Kairo-owned versioned spec, catalog, validator, and exhaustive renderer.
- Keep Zod only at the existing JSON Render adapter boundary where the package requires it.
- Use Effect Schema for Kairo domain and runtime schemas.
- Do not use the JSON Render renderer or catalog as the authority for production actions or persistence.
- Do not stream partial specs to the browser.
- Reject provider-generated handlers, arbitrary state bindings, repeats, watchers, URLs, HTML, CSS, code, and provider objects.

JSON Render's catalog and registry model support the bounded design, but its current public issues report silent validation field loss, Zod 4.4 compatibility failures, and React streaming update failures. See [the project README](https://github.com/vercel-labs/json-render), [issue 222](https://github.com/vercel-labs/json-render/issues/222), [issue 287](https://github.com/vercel-labs/json-render/issues/287), and [issue 311](https://github.com/vercel-labs/json-render/issues/311).

## Persistence and streaming

Persist the operation, transition state, request activity, and failed attempt separately from Generated view history.

A successful Generated view stores:

- view id, Canvas id, and history sequence;
- catalog, schema, model, prompt, and context versions;
- the complete validated Kairo spec;
- the bounded rationale and evidence references;
- the request activity that produced it; and
- creation time.

The history is append-only. Previous and next controls change the selected view without changing the Canvas URL. Reload selects the latest successful view.

Stream named transition events only:

~~~ts
type TransitionEvent =
  | "accepted"
  | "context_built"
  | "generating"
  | "clarifying"
  | "ready"
  | "failed"
  | "cancelled";
~~~

No partial spec becomes visible or enters history. The last usable view remains visible during generation, Clarification, and recovery.

## Privacy, ownership, and observability

- Send only selected User-owned academic context and explicitly attached File excerpts to OpenCode Go.
- Show provider disclosure before production generation is enabled.
- Do not log request or response bodies, raw prompts, model output, File bytes, Note content, filenames, storage URLs, auth headers, or query strings.
- Store only redacted attempt metadata: operation id, request id, route, status, latency, error category, release, versions, and provider request id.
- Retain redacted attempt metadata for 30 days, then delete it.
- Keep Sentry input and output capture disabled and scrub events before delivery.
- Apply User and Canvas deletion to activities, views, Files, attempts, and provider traces. Deletion tombstones prevent backups from resurrecting deleted data.
- The project owner is the v1 product, privacy, and release approver. Technical owners may implement the gateway, catalog, renderer, and Domain command service.

## Focused tests

### Context and token stability

- Same inputs and versions produce the same serialized ContextEnvelope.
- Record ordering, activity windows, File excerpt selection, and truncation are stable.
- Golden fixtures cover base, File-assisted, and history-assisted requests.
- Token counts stay within the measured target envelopes; a serializer change reports its variance.
- Current-view pronouns resolve from the selected Generated view and recent activity.
- Older history is fetched only through the approved tool and remains User-scoped.

### Model boundary

- Strict result validation rejects unknown union variants, components, props, references, Actions, URLs, handlers, HTML, CSS, code, and provider objects.
- One repair is allowed; a second failure enters recovery.
- Malformed, duplicated, truncated, out-of-order, and late stream events are safe.
- Provider network failure, 4xx, 5xx, timeout, quota, cancellation, and unexpected fields map to typed states.
- The configured model and provider model list are checked at release.

### Domain and ownership

- Two Users cannot read or mutate each other's Canvas, view, activity, File, or reference.
- Direct student facts can create one Domain command.
- File-inferred facts require Clarification.
- Repeated command ids apply once and return the original result.
- Expected-version conflicts leave data unchanged.
- Undo conflicts leave data unchanged.

### Rendering and recovery

- Complete valid views append once to immutable history.
- Invalid or partial views never enter history.
- Deleted live references render as unavailable without changing the saved spec.
- Reload during generating, Clarification, recovery, and cancellation restores the server-owned state.
- A lost generation response resumes the original result; a lost command response repeats the same idempotency key.
- Context affordance works on hover, keyboard focus, and reduced-motion settings.

### Privacy

- Logs and Sentry contain none of the forbidden prompt, output, File, Note, auth, filename, query, URL, or storage-key fields.
- Account deletion removes or tombstones all runtime and provider trace records.
- Release checks fail when provider privacy or retention verification is missing or stale.

## Sources

- [Kairo production Canvas contract](../../product/canvas-contracts.md)
- [Kairo production v1 decisions](../../product/production-v1-decisions.md)
- [Kairo production quality and operations bar](./production-quality-and-operations-bar.md)
- [OpenCode Go](https://dev.opencode.ai/docs/go/)
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [JSON Render](https://github.com/vercel-labs/json-render)
- [JSON Render issue 222](https://github.com/vercel-labs/json-render/issues/222)
- [JSON Render issue 287](https://github.com/vercel-labs/json-render/issues/287)
- [JSON Render issue 311](https://github.com/vercel-labs/json-render/issues/311)
