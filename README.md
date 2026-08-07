# Kairo

Kairo has qualified for Round 2. The current codebase starts from the Round 1 UI prototype and is now being shaped into a functional product with persisted data, backend behavior, and bounded generated views. Planning and implementation work is tracked in this repository's GitHub Issues.

The app uses Bun, TanStack Start, React 19, Tailwind CSS 4, Kumo UI, DM Sans, and JSON Render.

Install the pinned packages:

```bash
bun install
```

Start the app through portless with a fixed Tailscale-reachable app port:

```bash
bun run dev
```

Use the `Network` URL marked `tailscale0` in Vite's startup output on another
tailnet device. It uses the fixed app port `4173`, so the current form is
`http://<this-machine-tailscale-ip>:4173`. `https://kairo.localhost` remains
available locally through portless. The app provides design-neutral route
shells for `/canvas`, `/canvas/today`, `/tasks`, `/timetable`, `/deadlines`,
`/notes`, and `/focus`. TanStack Router generates `src/routeTree.gen.ts` from
files under `src/routes`.

Check generated routes and TypeScript:

```bash
bun run check
```

Build the production app with:

```bash
bun run build
```
