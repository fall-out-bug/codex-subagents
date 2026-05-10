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
- Define the metric before running experiments.
- Keep experiments bounded and replayable.
- Log failures as evidence, not as noise.
- Do not let research agents mutate production code unless the user explicitly converts the research into implementation work.

For context and role details, read `../references/context-and-roles.md` when needed.

## Research Loop

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
  --role-card roles/researcher.json \
  --background
```

4. Inspect logs and result:

```bash
codex-subagent inspect <run-id>
codex-subagent logs <run-id>
codex-subagent result <run-id>
```

5. Record:
   - hypothesis
   - experiment command or change
   - metric before/after
   - failure mode
   - next experiment

## Output

Return:

- research status: `assessed`, `partial`, or `not_assessed`
- experiment table
- metric deltas
- best candidate
- discarded candidates with reasons
- recommended next loop or implementation handoff
