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

For npm installs, use:

```bash
npm install -g @fall-out-bug/codex-subagents
```

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
codex-subagent role list
codex-subagent role show security-reviewer
```

Run an external agent:

```bash
codex-subagent run pi \
  --context-pack context.json \
  --role-template security-reviewer \
  --background
```

Run an independent review panel:

```bash
codex-subagent panel run pi \
  --context-pack context.json \
  --role requirements-reviewer \
  --role code-reviewer \
  --role security-reviewer

codex-subagent panel results <panel-id> --structured
```

Inspect evidence before trusting output:

```bash
codex-subagent inspect <run-id>
codex-subagent events <run-id>
codex-subagent logs <run-id> --stream stderr
codex-subagent result <run-id> --structured
```

For write-capable work, require worktree isolation:

```bash
codex-subagent run opencode \
  --context-pack worker-context.json \
  --role-template worker \
  --isolate worktree \
  --background
```

For bounded autoresearch, require a metric command that prints JSON with a numeric `score`:

```bash
codex-subagent autoresearch sources build \
  --query "research question" \
  --note "seed source" \
  --out sources.json

codex-subagent autoresearch run pi \
  --program program.md \
  --metric "npm run metric" \
  --candidates 5 \
  --model kimi-coding/k2p6 \
  --model zai/glm-5.1 \
  --sources sources.json

codex-subagent autoresearch status <research-id>
codex-subagent autoresearch patch <research-id>
```

Do not treat subagent output as approval to merge, deploy, publish, or widen scope. Treat missing or unusable evidence as `not_assessed`.
