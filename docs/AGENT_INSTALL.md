# Installing For Local Agents

Use this when a local Codex/Claude/OpenCode-style agent needs to use `codex-subagent` workflows.

## One-command local install

From the repository root:

```bash
./scripts/install-local-codex.sh
```

The installer:

- installs npm dependencies if needed;
- builds the CLI;
- links `codex-subagent` and `codex-subagents` into the local npm global bin path;
- symlinks workflow skills into `~/.codex/skills`;
- verifies the CLI version.

Installed skills:

- `subagent-review`
- `subagent-council`
- `subagent-dev`
- `subagent-research`

## Manual install

```bash
npm install
npm run build
npm link

mkdir -p ~/.codex/skills
ln -sfn "$PWD/skills/subagent-review" ~/.codex/skills/subagent-review
ln -sfn "$PWD/skills/subagent-council" ~/.codex/skills/subagent-council
ln -sfn "$PWD/skills/subagent-dev" ~/.codex/skills/subagent-dev
ln -sfn "$PWD/skills/subagent-research" ~/.codex/skills/subagent-research
```

Verify:

```bash
codex-subagent --version
ls -la ~/.codex/skills/subagent-*
```

Start a fresh Codex session after installing skills. Skill discovery is normally loaded at session start.

## Agent Usage Rules

Use one tool: `codex-subagent`.

Use skills as workflow wrappers:

- Use `subagent-review` for independent review planes.
- Use `subagent-council` for advisory debates and decision mapping.
- Use `subagent-dev` for explorer/planner/worker/tester/reviewer flows.
- Use `subagent-research` for autoresearch-style experiment loops.

Build typed context before launching external agents:

```bash
codex-subagent context build \
  --subject "Review parser change" \
  --mode review \
  --goal "Find blocking correctness and security issues" \
  --file src/parser.ts \
  --rule AGENTS.md \
  --diff \
  --out context.json
```

Validate role cards:

```bash
codex-subagent role validate roles/security-reviewer.json
```

Run an external agent:

```bash
codex-subagent run pi \
  --context-pack context.json \
  --role-card roles/security-reviewer.json \
  --background
```

Inspect evidence before trusting output:

```bash
codex-subagent inspect <run-id>
codex-subagent events <run-id>
codex-subagent logs <run-id> --stream stderr
codex-subagent result <run-id>
```

For write-capable work, require worktree isolation:

```bash
codex-subagent run opencode \
  --context-pack worker-context.json \
  --role-card roles/worker.json \
  --isolate worktree \
  --background
```

Do not treat subagent output as approval to merge, deploy, publish, or widen scope. Treat missing or unusable evidence as `not_assessed`.
