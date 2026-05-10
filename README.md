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
npm install -g codex-subagents
```

For local development:

```bash
npm install
npm run build
npm link
```

## Usage

Run a `pi` subagent:

```bash
codex-subagent run pi --profile readonly --task "Review src for risky file writes"
```

Run it in the background:

```bash
codex-subagent run pi --background --profile readonly --task "Review src for risky file writes"
```

Run an OpenCode subagent:

```bash
codex-subagent run opencode --agent explore --task "Map the authentication flow"
```

Run a GSD2 subagent:

```bash
codex-subagent run gsd2 --task "Create an implementation plan for the upload workflow"
```

Inspect runs:

```bash
codex-subagent list
codex-subagent status <run-id>
codex-subagent result <run-id>
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
```

## Current Scope

This is a bootstrap release. It supports synchronous and background execution. The next useful step is worktree isolation for write-capable agents and structured result parsing.
