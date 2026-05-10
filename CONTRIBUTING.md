# Contributing

The project goal is narrow: make external coding-agent runtimes usable as auditable subagents from Codex.

Good contributions improve one of these contracts:

- runtime adapters for `pi`, OpenCode, GSD2, or adjacent CLI agents
- durable run state and logs
- safe write isolation through worktrees or sandboxes
- structured result parsing
- tests that prove command construction, status transitions, and failure handling

Before opening a PR:

```bash
npm run check
```

Avoid broad framework rewrites unless they make the CLI easier to use or safer to trust.
