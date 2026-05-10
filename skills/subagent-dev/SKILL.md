---
name: subagent-dev
description: This skill should be used when the user asks for "development with subagents", "parallel coding agents", "use pi/opencode/gsd2 workers", "subagent implementation", "delegate coding work", or wants explorer/planner/worker/tester/reviewer agents coordinated from Codex.
version: 0.1.0
---

# Subagent Development

Coordinate implementation work through external subagents while keeping Codex as the integrator. Use `codex-subagent` for execution, isolation, logs, and inspection. Keep write-capable work isolated by default.

## Contract

- Use `context-pack/v1` for each bounded task.
- Use `role-card/v1` for each worker role.
- Use `--isolate worktree` for write-capable agents.
- Assign disjoint file ownership to parallel workers.
- Treat subagent output as work product, not truth. Inspect diffs, logs, tests, and events before integration.
- Do not let subagents merge, publish, deploy, or close tasks unless the user explicitly authorized that phase.

For context and role details, read `../references/context-and-roles.md` when needed.

## Roles

- `explorer`: read-only repo mapping, dependency discovery, risk scan.
- `planner`: slices work into bounded tasks with file ownership.
- `worker`: implements one bounded task in an isolated worktree.
- `tester`: runs checks and reports failures with reproduction commands.
- `reviewer`: reviews worker diff against context and acceptance criteria.
- `integrator`: Codex role; merges or ports changes after inspection.

## Workflow

1. Use an explorer for broad unknowns:

```bash
codex-subagent context build \
  --subject "Explore implementation surface" \
  --mode dev \
  --goal "Map files and risks; do not edit" \
  --rule AGENTS.md \
  --out explore-context.json

codex-subagent run opencode \
  --context-pack explore-context.json \
  --role-card roles/explorer.json \
  --background
```

2. Create a bounded plan with file ownership.
3. For each write worker:

```bash
codex-subagent run opencode \
  --context-pack worker-context.json \
  --role-card roles/worker.json \
  --isolate worktree \
  --background
```

4. Inspect every worker:

```bash
codex-subagent inspect <run-id>
codex-subagent events <run-id>
codex-subagent result <run-id>
```

5. Review worker diff with a separate reviewer.
6. Integrate only after local verification in the main workspace.

## Stop Conditions

Stop and ask the user when:

- file ownership overlaps between workers
- a worker needs unplanned write scope
- tests are absent or cannot run
- runtime output is empty, hung, or off-task
- integration requires merge, deploy, publish, or external side effects
