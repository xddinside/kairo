## Agent skills

### Engineering skills

- Effect work: load the `/effect` skill first (workflows, services, layers, schemas, configuration, schedules, streams, HTTP clients, tests).
- Coding work: load `/coding-standards` before writing or changing code.
- Subagents: direct them to the skills too, e.g. "use /effect /coding-standards and work on this: …".

### Issue tracker

Issues live in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use one project-wide `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

### UI descriptions

Do not add subtitles, helper text, or descriptive copy beneath headings, labels, cards, or settings by default. Prefer one concise, self-explanatory heading or label. Only add supporting copy when the user explicitly asks for it or when it is necessary to prevent misunderstanding or error, and never use it to restate the heading.
