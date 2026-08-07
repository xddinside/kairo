# JSON Render fit for Kairo

Research date: 2 August 2026

## Short answer

JSON Render fits Kairo if Round 1 uses it only inside `/canvas/today`. Kairo can hand-write one static JSON spec, render it through custom student-work components, and keep the shell and all normal routes as ordinary Next.js React UI.

This proves the bounded generative UI structure without adding an AI endpoint, streamed output, or working actions.

## Current packages

Pin these exact versions for the prototype:

```txt
@json-render/core@0.19.0
@json-render/react@0.19.0
zod@4.3.6
react@19.2.8
react-dom@19.2.8
```

Zod is not Kairo's app-schema choice. JSON Render 0.19 requires it as both a direct dependency and a peer dependency, and its catalog API uses Zod schemas for component props. Keep that use inside the JSON Render adapter. Kairo's own domain and data schemas will use Effect when that layer arrives in Round 2.

The current React package requires React `^19.2.3`. JSON Render remains below version 1.0 and has changed APIs in recent releases, so exact pins reduce avoidable drift.

Kairo does not need:

- `@json-render/next`, which targets whole apps defined by JSON, including routes and layouts
- `@json-render/shadcn`, which supplies generic ready-made components
- Vercel AI SDK packages, because Round 1 will not generate specs from a model

## How Kairo should use it

1. Define a small catalog with five to eight high-level Kairo blocks.
2. Map each catalog block to a custom React component in a registry.
3. Hand-write one flat `root` plus `elements` JSON spec for `/canvas/today`.
4. Keep the shell, `/canvas`, and the five supporting routes as normal React UI.
5. Use only read-only state references if the generated view needs data from the shared student fixture.
6. Skip actions, two-way binding, repeats, watchers, streaming, and model prompts for Round 1.

Possible first catalog:

- `WorkspaceHeader`
- `PrimaryTask`
- `TaskOption`
- `WhyNow`
- `DeadlineAlert`
- `FocusAction`
- `ContextItem`
- `Stack` or `Grid`

The later catalog-design ticket should change this list based on the UI prototypes.

## Useful library features

- A catalog limits which components and actions a generated spec may name.
- JSON Render's required Zod schemas define each generated component's allowed props.
- A registry maps catalog names to Kairo's React components.
- Specs may come from AI, a database, an API, or hand-written static JSON.
- `$state` reads data by JSON Pointer path. `$bindState` supports two-way input binding.
- Named actions call handlers supplied by the app instead of running generated code.
- `useUIStream` can compile streamed JSONL patches into a changing spec.
- `catalog.prompt()` can later create model instructions from the same catalog.

## Current limits

- JSON Render is pre-1.0 and its migration guide shows recent API changes. Pin versions.
- Zod 4.4 has open compatibility faults with JSON Render 0.19. Use Zod 4.3.6 for now.
- An open issue reports that `catalog.validate()` strips `on`, `repeat`, `watch`, and `state` from returned specs. This does not affect a plain read-only spec if Kairo avoids that path.
- An open issue reports heavy rerenders and possible memory failure for large streamed, state-bound specs. Kairo will not stream in Round 1.
- An open Tailwind issue affects some ready-made shadcn classes that exist only inside the package. Custom Kairo components keep their classes in app source and avoid this setup issue.

None of these limits blocks the fixed `/canvas/today` plan.

## Official sources

- [JSON Render repository](https://github.com/vercel-labs/json-render)
- [Installation](https://json-render.dev/docs/installation)
- [Static and generated specs](https://json-render.dev/docs/specs)
- [Catalogs](https://json-render.dev/docs/catalog)
- [React registries, actions, and binding](https://json-render.dev/docs/registry)
- [Streaming](https://json-render.dev/docs/streaming)
- [Migration guide](https://json-render.dev/docs/migration)
- [React package manifest](https://github.com/vercel-labs/json-render/blob/main/packages/react/package.json)
- [Zod 4.4 compatibility issue](https://github.com/vercel-labs/json-render/issues/287)
- [Validation field-loss issue](https://github.com/vercel-labs/json-render/issues/222)
- [Large-stream rerender issue](https://github.com/vercel-labs/json-render/issues/311)
- [Tailwind package-source issue](https://github.com/vercel-labs/json-render/issues/312)

## Recommendation

Use JSON Render now, but keep the boundary narrow: one custom catalog, one custom registry, and one hand-written spec inside `/canvas/today`. This adds a credible technical base for the core idea while leaving the visual shell free to move quickly.

## Chosen app stack

The user chose this changeable project baseline:

- Bun for package and script work
- TanStack Start for the React app, with its built-in TanStack Router base
- Vite as TanStack Start's build adapter
- Tailwind CSS 4
- `@cloudflare/kumo` as the base component library
- DM Sans as the product typeface
- Custom Kairo blocks, composed from Kumo parts, as JSON Render registry components
- Effect for later domain, service, schema, and state work when Round 2 needs it

Use TanStack Start with its Vite adapter and file-based routes. Round 1 can stay static and client-focused; Start leaves room for server functions and API routes in Round 2. Start is still a release candidate, so pin its package versions when the app is scaffolded. As checked on 2026-08-02, the published versions are `@tanstack/react-start@1.168.34` and `@tanstack/react-router@1.170.18`.

Kumo 2.9 is compatible with React 19. Its Zod peer is optional, but JSON Render requires Zod 4. Kumo's `LinkProvider` can map Kumo links to TanStack Router links. Its Tailwind setup must include the documented `@source` path for Kumo's package files.

Do not install Effect for the static Round 1 UI. When Round 2 starts, reassess the current Effect release before pinning it. In Effect v4, use `Schema` from `effect` and React atoms from `@effect/atom-react`; there is no separate `effect-schema` package in this plan. Use Effect Schema for Kairo's app and domain data. Limit Zod to the JSON Render adapter that requires it.

Further official sources:

- [Kumo installation and Tailwind setup](https://kumo-ui.com/installation/)
- [Kumo component catalog](https://kumo-ui.com/registry/)
- [TanStack Start overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- [TanStack Start hosting, including Bun](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [Effect](https://effect.website/)
