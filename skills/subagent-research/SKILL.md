---
name: subagent-research
description: This skill should be used when the user asks for "autoresearch", "research loop", "experiment loop", "agentic research", "benchmark variants", "try approaches overnight", or wants subagents to run hypotheses, experiments, metrics, and logs.
version: 0.1.0
---

# Subagent Research

Run autoresearch-style loops through `codex-subagent`: hypothesis, experiment, metric, result, keep or discard. Use this for prompt experiments, evals, benchmarks, retrieval variants, model comparisons, UX copy variants, and small code research tasks.

## Contract

- Use `context-pack/v1` with `mode: research`.
- Use `role-card/v1` for researcher, experimenter, evaluator, and synthesizer roles.
- Require `subagent-result/v1` structured output for each research run.
- Define the metric before running experiments.
- Keep experiments bounded and replayable.
- Log failures as evidence, not as noise.
- Do not let research agents mutate production code unless the user explicitly converts the research into implementation work.

For context and role details, read `../references/context-and-roles.md` when needed.

## Research Loop

Prefer the native autoresearch command when there is a metric command and candidate budget:

```bash
codex-subagent autoresearch run pi \
  --program program.md \
  --metric "<command that prints JSON with numeric score>" \
  --candidates 5
```

Use this mode only when a higher-is-better metric is defined. Each candidate runs in an isolated worktree and writes `experiments.jsonl` plus `result.json` under `.codex-subagents/autoresearch/<research-id>/`.

1. Write a short research brief:
   - question
   - hypothesis
   - metric
   - budget
   - allowed files or commands
   - stop condition
2. Build context:

```bash
codex-subagent context build \
  --subject "<research question>" \
  --mode research \
  --goal "Run bounded experiments and report metric deltas" \
  --file research-brief.md \
  --rule AGENTS.md \
  --out context.json
```

3. Run the researcher:

```bash
codex-subagent run pi \
  --context-pack context.json \
  --role-template researcher \
  --background
```

4. Inspect logs and result:

```bash
codex-subagent inspect <run-id>
codex-subagent logs <run-id>
codex-subagent result <run-id> --structured
```

5. Record:
   - hypothesis
   - experiment command or change
   - metric before/after
   - failure mode
   - next experiment

## Program File

Keep `program.md` short and operational:

- question
- hypothesis
- metric and baseline
- allowed files or commands
- candidate budget
- stop condition
- keep/revert policy

Do not let research agents edit `program.md`, skills, publishing config, or production code outside the explicit experiment scope unless the user converts the research into implementation work.

## Output

Return:

- research status: `assessed`, `partial`, or `not_assessed`
- experiment table
- metric deltas
- best candidate
- discarded candidates with reasons
- recommended next loop or implementation handoff
