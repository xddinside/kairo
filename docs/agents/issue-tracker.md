# Issue tracker: GitHub Issues

Issues and product requirement discussions for this repository live in GitHub Issues. Do not create new issue files under `.scratch/`; that directory is only a local migration source and is ignored by Git.

## Access

Use the GitHub CLI from the repository root:

```bash
gh repo view
gh issue list
gh issue view <number>
```

If the repository has no GitHub remote yet, finish repository creation before creating or changing issues.

## Conventions

- One outcome or decision per issue.
- Keep the question or acceptance criteria in the issue body.
- Use comments for conversation history and investigation results.
- Use the five triage labels from `docs/agents/triage-labels.md`.
- Record work type with `type:research`, `type:prototype`, `type:grilling`, or `type:task` when those labels exist.
- Express dependencies as `Blocked by #NN` in the issue body and keep those references current.
- Assign an issue when claiming it; close it only after posting the result or completion evidence.

## Common operations

```bash
# Find work
gh issue list --state open

# Read and claim
gh issue view <number> --comments
gh issue edit <number> --add-assignee @me

# Report progress or a decision
gh issue comment <number> --body-file <file>

# Resolve
gh issue close <number> --comment "<completion summary>"
```

Prefer `--body-file` for substantial Markdown so shell quoting does not damage formatting.

## Wayfinding

- A map is a GitHub issue with the `wayfinder:map` label.
- Child work is linked from the map issue with a task list or explicit issue references.
- The frontier is the lowest-numbered open, unassigned child whose `Blocked by` issues are all closed.
- Claim the frontier by assigning it before starting work.
- When resolving a child, post the answer or evidence, close it, and update the map issue's decisions or remaining task list.
- A grilling issue remains open until the user confirms shared understanding; do not enact its plan early.

## Migration

Historical Markdown issues under the ignored `.scratch/` directory should be imported into GitHub before that local directory is deleted. Move durable research and design references into `docs/` rather than embedding them only in closed issue bodies.
