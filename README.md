# codex-subagents

Run external `pi`, `opencode`, and `gsd2` agents as subagents from Codex.

This project is intentionally small: Codex can call a local CLI, the CLI starts a real agent runtime, and every run is written to a durable directory with request, status, logs, and result files.

## Why

Codex already has a strong interactive UX. `pi`, OpenCode, and GSD2 have useful agent runtimes and workflows. `codex-subagents` provides the missing bridge:

- launch a focused external agent from a Codex session
- keep each run auditable
- preserve status as `pass`, `fail`, `partial`, or `not_assessed`
- make read-only and write-capable profiles explicit

## Install

```bash
npm install -g @fall-out-bug/codex-subagents
```

For local development:

```bash
npm install
npm run build
npm link
```

For local Codex skill integration:

```bash
./scripts/install-local-codex.sh
```

Detailed agent installation instructions: [`docs/AGENT_INSTALL.md`](docs/AGENT_INSTALL.md).

Publishing instructions: [`docs/PUBLISHING.md`](docs/PUBLISHING.md).

## Usage

Run a `pi` subagent:

```bash
codex-subagent run pi --profile readonly --task "Review src for risky file writes"
```

Run it in the background:

```bash
codex-subagent run pi --background --profile readonly --task "Review src for risky file writes"
```

Run a write-capable agent in an isolated git worktree:

```bash
codex-subagent run opencode --isolate worktree --agent build --task "Implement the parser"
```

Build a typed context pack and run a role-bound agent:

```bash
codex-subagent role list
codex-subagent role write security-reviewer --out security-reviewer.json

codex-subagent context build \
  --subject "PR review" \
  --mode review \
  --goal "Find blocking correctness and security issues" \
  --file src/parser.ts \
  --rule AGENTS.md \
  --diff \
  --out context.json

codex-subagent role validate security-reviewer.json

codex-subagent run pi \
  --context-pack context.json \
  --role-template security-reviewer
```

Run an OpenCode subagent:

```bash
codex-subagent run opencode --agent explore --task "Map the authentication flow"
```

Run a GSD2 subagent:

```bash
codex-subagent run gsd2 --task "Create an implementation plan for the upload workflow"
```

Run a multi-role panel:

```bash
codex-subagent panel run pi \
  --context-pack context.json \
  --role requirements-reviewer \
  --role code-reviewer \
  --role security-reviewer

codex-subagent panel status <panel-id>
codex-subagent panel results <panel-id> --structured
```

Run a bounded autoresearch loop:

```bash
codex-subagent autoresearch run pi \
  --program program.md \
  --metric "npm run metric" \
  --candidates 5
```

The metric command must print JSON with a numeric `score`; higher is better. Autoresearch records a baseline before trying candidates and only selects a best candidate when it beats that baseline. Each candidate runs in an isolated git worktree. The run writes `program.md`, `baseline.json`, `experiments.jsonl`, candidate `patch.diff` files, `best.patch`, and `result.json` under `.codex-subagents/autoresearch/<research-id>/`.

Inspect runs:

```bash
codex-subagent list
codex-subagent status <run-id>
codex-subagent inspect <run-id>
codex-subagent events <run-id>
codex-subagent logs <run-id> --stream stderr
codex-subagent result <run-id>
codex-subagent result <run-id> --structured
codex-subagent cancel <run-id>
```

## Run Directory

Each run is stored under `.codex-subagents/runs/<run-id>/`:

```text
request.json
status.json
stdout.log
stderr.log
result.md
events.jsonl
```

When `--isolate worktree` is used, the run also creates `.codex-subagents/worktrees/<run-id>/` and executes the agent there. The source repository keeps the run registry.

Panels are stored under `.codex-subagents/panels/<panel-id>.json` and reference the child run ids for each role.
Use `panel results <panel-id> --structured` to aggregate child `subagent-result/v1` outputs with summary status, structured/unstructured counts, finding severity counts, and evidence gaps.

## Context Packs

`context-pack/v1` is the portable context envelope used by review panels, councils, development subagents, and research loops. It separates trusted rules from untrusted artifacts such as diffs, logs, evidence, and file contents.

`role-card/v1` defines the agent role contract: plane, mission, authority, veto domain, forbidden actions, output schema, and model policy.

`subagent-result/v1` is the normalized result contract. Agents should end with a fenced JSON block containing `status`, `summary`, `findings`, `evidence`, and `nextActions`. `codex-subagent result <run-id> --structured` parses that block; unstructured text is returned as `not_assessed` instead of being treated as proof.

Built-in role templates cover the common workflows:

- review: `requirements-reviewer`, `code-reviewer`, `ux-reviewer`, `evidence-reviewer`, `security-reviewer`
- council: `architect`, `critic`, `technician`, `pragmatist`, `engineer`
- dev: `explorer`, `planner`, `worker`, `tester`, `reviewer`
- research: `researcher`, `experimenter`, `evaluator`, `synthesizer`

## Skills

Reusable workflow skills live in `skills/`:

- `skills/subagent-review` — multi-plane review with independent roles.
- `skills/subagent-council` — advisory deliberation and disagreement mapping.
- `skills/subagent-dev` — explorer/planner/worker/tester/reviewer flows with worktree isolation.
- `skills/subagent-research` — autoresearch-style experiment loops.

Each skill is intentionally thin. It uses `codex-subagent` for execution, context packs, role cards, logs, events, and inspection.

## Current Scope

This is a bootstrap release. It supports synchronous and background execution, structured JSONL events, git worktree isolation, typed context packs, and role cards. The next useful step is structured result parsing.
