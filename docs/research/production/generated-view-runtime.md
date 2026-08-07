# Kairo production generated-view runtime

Research date: 7 August 2026

## Decision

Use the OpenAI Responses API with `gpt-5.6-terra` and the official `openai` TypeScript SDK. Put it behind a small Kairo-owned `ModelGateway` so the rest of the app does not depend on provider response types.

Start with low reasoning effort. The model and effort must remain server config, not client input. Promote a new model or effort only after it passes Kairo's generated-view and action evals. OpenAI names Terra as its balance of intelligence and cost; it supports streaming, function calls, and structured outputs.

Replace JSON Render in the production trust path with a Kairo-owned, versioned generated-view schema, catalog, validator, and React renderer. Keep the useful idea: the model may compose only named Kairo blocks and named actions. It may never return JSX, HTML, CSS, JavaScript, URLs, state paths, or executable code.

Do not add Vercel AI SDK for v1. It is viable, but it would add a second provider layer while Kairo needs OpenAI Responses features and a narrow app-owned boundary. Its telemetry hook also remains experimental. Revisit this only if Kairo needs a second model provider.

## Why JSON Render stops here

The checkout uses `@json-render/core` and `@json-render/react` 0.19.0 for a fixed Round 1 view. Version 0.19.0 is still the latest published release.

JSON Render's catalog and registry match Kairo's product rule, but its production paths do not yet meet Kairo's bar:

- `catalog.validate()` has an open fault that removes action, repeat, watch, and state fields from validated output.
- Zod 4.4 compatibility remains an open issue. This checkout uses Zod 4.4.3.
- Progressive React rendering has an open maximum-update-depth and memory-failure report.
- Its documented server flow asks a model to emit JSON Patch lines as plain streamed text. The client applies each patch and renders the partial spec before the final spec can pass whole-document and domain checks.

JSON Render's unreleased main branch contains work in these areas, but production Kairo cannot depend on unreleased fixes. Kairo has a small set of high-level blocks, so its own exhaustive renderer is less risky than wrapping these faults.

Remove JSON Render only when the new renderer covers the current fixed view. This is a migration choice, not a request to remove the Round 1 proof now.

## Runtime boundary

One Canvas turn should follow this server-owned sequence:

1. Authenticate the request and create an idempotent generation run.
2. Load the Canvas and only the signed-in student's allowed context.
3. Let the model call a small set of read-only tools, such as listing tasks, deadlines, timetable entries, notes, and the active focus session. Limit the loop by tool set, rounds, time, and token budget.
4. Ask for one strict result: either a clarification set or a ready result containing proposed domain commands and a generated-view spec.
5. Validate the provider result again in Kairo. Apply graph, catalog, reference, size, and policy checks that a JSON schema cannot express.
6. Authorize and execute valid commands through domain services. Never let model tools write to the database.
7. Store the completed spec and command results, then publish `view.ready`. If clarification is needed, publish the one paged Clarification state instead.

Use strict structured outputs for the final result and strict schemas for tool arguments. Set `parallel_tool_calls: false` for this first runtime. Schema-valid data can still contain a wrong task, date, or action, so validation cannot stop at JSON shape.

The first tool loop should expose read tools only. Direct user instructions become proposed domain commands in the final result. File-derived facts must become clarification questions unless the student already confirmed them. The server derives that permission from request provenance; it must not trust a model-supplied `confirmed` flag.

## Catalog and validation

The catalog must be code, not prompt text alone. Each release should define:

- A discriminated union for every block and its exact props.
- A fixed set of action slots allowed on each block.
- A versioned `GeneratedViewSpec` with `schemaVersion`, `catalogVersion`, `root`, and elements.
- Limits for element count, nesting depth, text length, and child count.

After strict provider parsing, Kairo must check:

- The root exists; every child exists; the graph has no cycles or unreachable elements.
- Every block and prop belongs to the named catalog version; unknown keys fail closed.
- Every action is allowed on that block and has the right target type.
- Every entity reference has the right shape. The server later resolves it inside the signed-in student's scope.
- No raw HTML, style or class names, script, handler, arbitrary URL, database query, or free state path exists.
- The final spec stays within size and complexity limits.

Render with an exhaustive component map. Missing catalog versions should show a safe recovery state, not guess at a modern equivalent.

## Action authorization

A generated action is a request, not authority.

Persist action descriptors inside the validated view. On a click, the client should send the view ID, element ID, action slot, expected record version, and an idempotency key. The server must reload the canonical descriptor from the stored view, then:

1. Resolve the Clerk user on the server; never accept a user ID from the model or client.
2. Check that the user owns the Canvas, view, target record, and any linked file.
3. Revalidate the action against the stored catalog version and current record state.
4. Apply the domain command in a transaction with optimistic concurrency and a unique command ID.
5. Write an audit record and the inverse data needed for Undo.

Do not put destructive actions in the first generated catalog. Stable routes can still support delete with confirmation. Canvas can gain destructive actions later when their confirmation and recovery contract is explicit.

## Streaming and transition states

Stream Kairo runtime events, not a half-built interface:

- `turn.accepted`
- `context.loading`
- `context.ready`
- `view.generating`
- `clarification.ready`
- `view.ready`
- `turn.failed`

Use server-sent events from the TanStack Start server route. The server may consume the provider stream to detect cancellation, usage, refusal, and failure, but it should not forward raw model text or partial JSON to the renderer. Keep the last usable generated view on screen until the next full spec passes validation. This matches the product decision that loading, clarification, and recovery are transition states, not generated-view history.

## Persistence

Persist only complete, validated generated views in history. Store each as an immutable row with:

- Canvas ID and monotonic position.
- Normalized spec JSON.
- Schema and catalog versions.
- Prompt-policy version, provider, model, and reasoning effort.
- Generation run ID, creation time, and the IDs of commands caused by the turn.

Use entity references in blocks so an older layout can show current task, deadline, note, and focus state. Keep generated labels and reasoning text as the original view content. This preserves the old composition while shared academic data stays live.

Store generation attempts separately from views. An attempt may end as clarification, refusal, cancellation, validation failure, provider failure, or success. Do not put failed or partial specs in generated-view history.

Kairo should own Canvas history in its database. Use `store: false` for provider requests unless a later privacy review chooses provider-held state. Do not make `previous_response_id` the source of truth for a Canvas.

## Retries and recovery

- Give each submitted turn one idempotency key. A reload or reconnect must resume or return the same run, not create another command.
- Keep the SDK's two transient retries only for connection failures, 408, 409, 429, and server errors. Use a short app-level deadline; the SDK default of ten minutes is too long for Canvas.
- Retry a structurally valid but catalog-invalid result once with compact validation errors. Do not retry refusals, policy failures, or bad user input as if they were network faults.
- Cap read-tool rounds and total tool calls. A limit hit becomes a recovery state with a retry action.
- Commit each domain command once. Provider retry and browser retry must not repeat a write.
- If command execution succeeds but view persistence fails, retain the command audit and show the data change plus recovery. Never hide a committed change behind a failed view.
- Cancellation leaves the last usable view intact and stores no generated view.

## Observability and evals

Create one trace per Canvas turn and spans for context load, each model call, each read tool, validation, command execution, and persistence. Record:

- Generation run and Canvas turn IDs.
- OpenAI request ID and Kairo client request ID.
- Model, effort, prompt-policy, schema, and catalog versions.
- Latency, time to ready, tokens, cached tokens, estimated cost, retries, tool counts, and stop reason.
- Refusals, incomplete outputs, validation codes, stale-record conflicts, action outcomes, and Undo outcomes.

Do not record prompts, file text, note bodies, full specs, tool results, or model output in normal telemetry. They contain private student data. Use a stable, hashed safety identifier for provider calls.

Before any model or prompt change reaches all users, run a fixed eval set that covers planning, workload, focus, direct task and deadline edits, ambiguous file facts, missing records, stale actions, hostile prompt text in notes, mobile-sized views, and catalog limits. Track task correctness, clarification correctness, forbidden writes, valid-spec rate, action-target accuracy, latency, and cost. Roll out changes behind a version flag and keep the prior version available for rollback.

## Package direction

At the time of research:

- `openai` latest: 7.4.0, released 3 August 2026; it supports Zod 3 and 4.
- `@json-render/core` and `@json-render/react` latest: 0.19.0.
- This checkout already has Zod 4.4.3 and no model SDK.

Add the official SDK only during implementation. Keep Zod inside the model/generated-view adapter if Kairo uses another schema system for domain data.

## Official evidence

- [OpenAI model guide](https://developers.openai.com/api/docs/models)
- [GPT-5.6 Terra capabilities and pricing](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
- [GPT-5.6 production guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [OpenAI API request IDs and compatibility](https://developers.openai.com/api/reference/overview#backwards-compatibility)
- [Official OpenAI TypeScript SDK](https://github.com/openai/openai-node)
- [OpenAI SDK 7.4.0 release](https://github.com/openai/openai-node/releases/tag/v7.4.0)
- [Structured Outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/)
- [Function calling and strict arguments](https://help.openai.com/en/articles/8555517)
- [AI SDK core overview](https://ai-sdk.dev/docs/ai-sdk-core/overview)
- [AI SDK telemetry status](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)
- [JSON Render catalog](https://json-render.dev/docs/catalog)
- [JSON Render registry and actions](https://json-render.dev/docs/registry)
- [JSON Render streaming](https://json-render.dev/docs/streaming)
- [JSON Render 0.19.0 release](https://github.com/vercel-labs/json-render/releases/tag/v0.19.0)
- [JSON Render validation field-loss issue](https://github.com/vercel-labs/json-render/issues/222)
- [JSON Render Zod 4.4 issue](https://github.com/vercel-labs/json-render/issues/287)
- [JSON Render streaming memory issue](https://github.com/vercel-labs/json-render/issues/311)
