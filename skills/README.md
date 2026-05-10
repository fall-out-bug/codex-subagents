# codex-subagents skills

These skills are workflow wrappers around one tool: `codex-subagent`.

They do not implement their own runners. They build `context-pack/v1` and `role-card/v1` inputs, launch `pi`, OpenCode, or GSD2 through `codex-subagent`, then inspect durable artifacts.

Available skills:

- `subagent-review` — multi-plane code, spec, idea, and evidence review.
- `subagent-council` — advisory deliberation for decisions and tradeoffs.
- `subagent-dev` — subagent-assisted implementation with worktree isolation.
- `subagent-research` — autoresearch-style experiment loops.
