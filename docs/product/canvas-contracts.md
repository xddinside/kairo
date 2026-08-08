# Kairo Canvas generation, action, and recovery contracts

Status: Decided for production v1

Source discussion: [Specify Canvas generation, action, and recovery contracts](https://github.com/xddinside/kairo/issues/9)

## Scope

This document defines the contract that a student can observe at the Canvas boundary. It covers Canvas activities, generation, the Component catalog, Actions, Domain commands, Undo, Clarification, Generated view history, live-data reconciliation, authorization, and recovery.

The model context builder, provider adapter, agent loop, and Kairo-owned renderer internals belong to [Grill Kairo model context, agent loop, and production generated-view renderer](https://github.com/xddinside/kairo/issues/17). They must satisfy this document without exposing provider-specific response shapes or generated code to Canvas.

File extraction and document grounding belong to [Specify Kairo document ingestion and viewing](https://github.com/xddinside/kairo/issues/12). Focus interaction design belongs to [Redesign Focus and document-assisted sessions](https://github.com/xddinside/kairo/issues/13).

## Invariants

- Every Canvas and every operation belongs to the current `User`.
- A Canvas has at most one active generation or Clarification transition.
- A Canvas request has one terminal product outcome: a Generated view, a Clarification, a direct command result, a recoverable failure, or cancellation. It does not silently combine a data mutation and a new Generated view.
- Only a complete, validated Generated view enters Generated view history.
- Generated views are immutable records. Their data references are live and are resolved for the current User when they render.
- Actions never execute generated code. Mutating Actions become one server-authorized Domain command.
- A repeated Domain command never applies its mutation twice.
- A failure never removes the last usable Generated view or creates a false history entry.
- A foreign or missing record never reveals whether another User owns it.

## Canvas activities

Canvas activity is the ordered student-facing record in a saved Canvas. The activity union is:

- `request`: the student's typed request, its source view when relevant, and the attached File references.
- `attachment`: a File made available to the Canvas.
- `clarification_answer`: the student's free-text answer to one pending Clarification question.
- `accepted_action`: an Action the student explicitly invoked, or a direct student instruction that Kairo accepted as a Domain command.

The server assigns the activity id and sequence. It records the activity before starting its side effect. If the activity cannot be saved, the side effect does not start. Model messages, tool calls, partial specs, provider payloads, and internal traces are not Canvas activities; they belong to the separate attempt and observability records.

The first meaningful request, attachment, or accepted action creates a Canvas from Canvas home. Canvas creation and the first activity use a client request id so a retry or a second browser tab cannot create duplicate Canvases or activities.

## Canvas transitions

Transitions are persisted so a reload can restore the correct state, but they are not Generated view history entries.

### Generating

`generating` contains an operation id, the request activity id, the source view id when present, and a retryable status. The last usable Generated view remains visible. The composer cannot submit a second generation while this transition is active. The student may cancel it.

### Clarification

`clarifying` contains one transition id, the pending operation type, a set of ordered questions, saved answers, and the next unanswered question. One panel shows one question at a time with previous and next controls, a position count, and free-text input. Suggested answers are shortcuts only.

The last usable Generated view remains visible. The composer accepts only the current Clarification answer. New generation and mutating Actions wait until the Clarification is complete; navigation and read-only view use remain available.

Each submitted answer is saved as Canvas activity before the next question is shown. There is no separate dismiss or review step. The student can answer in their own words, reject a proposed change, or say to ignore it. A rejection closes the pending operation with no write. After the last answer, Kairo automatically resumes the pending operation after revalidating current data.

Reload restores a pending Clarification. If the pending operation has expired or its inputs no longer fit, Kairo moves to recovery or asks a new Clarification instead of applying stale work.

### Recovering

`recovering` contains the operation id, a safe user-facing failure category, whether retry is allowed, and the id of the last usable view. It does not contain provider payloads, private model text, or stack traces. The student can retry or cancel. Cancelling returns the Canvas to idle without adding history or changing shared academic data.

## Generation contract

A Canvas generation request contains:

- the saved Canvas id, or a client request id when starting from Canvas home;
- the new request activity id;
- the student's text;
- optional File references;
- the selected Generated view id, if the request was made while browsing history;
- a client operation id for safe retry and cancellation.

The server supplies the current User, current academic data, current focus state, and the approved model/runtime context. Client-provided ids are hints for lookup, not authority.

The generation result is one of:

- `clarification_required`, which starts one Clarification transition;
- `view_ready`, which contains one complete Generated view and appends it to history;
- `direct_command_result`, which contains the outcome of one accepted Domain command and does not append a Generated view;
- `recoverable_failure`, which starts recovery; or
- `cancelled`.

The runtime may stream named transition events such as accepted, clarifying, generating, ready, failed, and cancelled. It never streams a partially trusted UI spec into the renderer. A view becomes visible as a Generated view only after the complete spec, catalog version, policy checks, and data-reference checks pass.

## Generated view and Component catalog

A persisted Generated view contains at least:

- a view id, Canvas id, history sequence, and creation time;
- the catalog, schema, model, and prompt versions used to create it;
- the validated Kairo-owned spec;
- bounded rationale and evidence references suitable for the student; and
- the request activity that produced it.

The spec may name only catalog components, typed props, approved live data references, and catalog Actions. It may not contain executable code, HTML, CSS, URLs, event handlers, arbitrary state paths, or provider-specific objects. Unknown components, unknown props, invalid references, and invalid Actions fail validation and never enter history.

The view's rationale is a concise product explanation, not hidden model reasoning. It may point to current academic records or File references that the student is allowed to see.

## Generated view history

- History is an append-only ordered list of successful Generated views within one Canvas.
- Previous and next controls change the selected view without changing the Canvas URL.
- A new generation while an older view is selected appends at the end. It does not delete or branch the later history.
- Reload selects the latest successful view.
- Clarification, generation, recovery, cancellation, direct commands, and failed attempts are not history entries.
- A successful Domain command does not create a Generated view. The selected view re-renders against current shared academic data.

If a live reference is deleted or unavailable, its block shows an unavailable or empty state while the rest of the view remains usable. Kairo does not rewrite the immutable spec or silently generate a replacement.

## Actions and Domain commands

An Action is a named operation in the Component catalog. Actions have a typed kind:

- read-only Actions may open a stable route, reveal a permitted record, select a note, or start another safe view interaction;
- mutating Actions become one typed Domain command.

The renderer dispatches only catalog-owned Action names. It never executes a model-supplied handler.

A Domain command contains:

- a command id and idempotency key;
- the current User and Canvas context from the server;
- the source activity and Action name;
- typed arguments validated against the Action contract; and
- expected versions for every record it will change.

The server reloads canonical records, checks ownership and current versions, validates the domain rule, and commits one atomic change. Bulk writes and silent multi-command plans are out of scope. A direct, explicit student fact or instruction may become an accepted Domain command without another confirmation. A fact inferred from a File always requires Clarification first.

Command results are one of:

- `applied`, with the changed-record summary and an optional Undo token;
- `already_applied`, returning the original result for a repeated idempotency key;
- `conflict`, when an expected version is stale;
- `not_found`, using the same result for foreign and missing records;
- `invalid`, when the Action or arguments fail validation; or
- a typed recoverable failure such as a timeout, quota, or provider-independent service error.

A conflict never overwrites current data. The current Generated view remains visible, and Canvas offers refresh or a new generation. It does not retry the command with new versions without the student's action.

## Undo

Every reversible successful Domain command returns a server-held inverse and an Undo token. Immediate feedback exposes Undo for that command; Kairo does not promise a global undo stack. Undo is a new Domain command with its own idempotency key and expected versions. If another change makes the inverse unsafe, Undo returns a conflict and leaves data unchanged. Irreversible changes have no Undo token.

## Live-data reconciliation

Generated view specs and rationale stay fixed. Each approved data reference resolves against the current User-owned record at render time. This lets an older view show current task completion, timetable changes, focus state, or note content without changing its history identity.

After a successful command, the selected view re-renders from the updated shared data and shows immediate feedback. If a command removes or invalidates a referenced record, the affected block becomes unavailable or empty. Kairo does not auto-generate a new view as a side effect of a command.

## Authorization

Every Canvas load, history read, File reference, live data reference, Action, Undo token, and Domain command is checked against the current User on the server. Model context tools receive only current User-owned data selected by the model-context contract.

The browser cannot grant access by sending a Canvas id, record id, Action id, or version. Foreign and unknown ids use the same not-found or unavailable result. Archived Canvases remain readable and restorable but reject new activity, generation, and mutation until restored.

## Recovery rules

- A malformed or unsafe spec produces no Generated view. The model/runtime boundary may make its bounded repair attempt; a second failure enters recovery.
- A provider timeout, provider outage, quota limit, validation failure, or service error keeps the last view and enters recovery with a retryable category when safe.
- Retrying generation creates a new operation against current data. It cannot duplicate a committed Domain command or append the same Generated view twice.
- If the client loses a generation response, it polls or resumes the same operation id before offering a new attempt. If the operation is already committed, the original result is returned.
- If the client loses a command response, it repeats the same command id and idempotency key. It never creates a new command merely because the response was lost.
- Cancelling a generation is best effort. If the server committed a view before cancellation arrived, the student receives that one view; otherwise no history entry is created.
- A command failure leaves the selected Generated view and shared data unchanged unless the command result is `applied` or `already_applied`.
- Recovery records retain enough redacted metadata for support and evaluation, but they do not become Canvas activity or Generated view history.

## Acceptance scenarios

1. A request from Canvas home creates one saved Canvas and one request activity.
2. An explicit “add this Task” request creates one accepted action and one Domain command, shows Undo, and does not create a Generated view.
3. A File-derived Task is proposed through Clarification and is not written until the student accepts it.
4. A plan request emits transitions and appends exactly one validated Generated view.
5. A request from an older view appends a new view without deleting later history.
6. A repeated command id returns the first result and changes data only once.
7. A stale command returns conflict, leaves data unchanged, and keeps the current view usable.
8. A deleted live reference renders as unavailable without changing the saved view spec.
9. An invalid generated spec enters recovery and never appears in history.
10. Reload during generating, Clarification, or recovery restores the server-owned transition or operation status.
11. A foreign Canvas or record returns the same not-found or unavailable result as an unknown id.
12. An archived Canvas can be read or restored but rejects new activity until restored.

## Follow-up boundaries

The following decisions remain in their own tickets and must implement these contracts rather than redefine them:

- model context, agent loop, provider limits, renderer internals, and observability;
- Markdown/PDF extraction, storage, viewing, and document-grounded inference;
- Focus interaction design;
- notification behavior; and
- production quality, security, performance, retention, and launch checks.
