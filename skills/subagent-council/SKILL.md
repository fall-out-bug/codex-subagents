---
name: subagent-council
description: This skill should be used when the user asks for "LLM council", "agents arguing", "decision debate", "model council", "advisory board", "council of agents", or wants multiple LLMs to debate an architecture, product, strategy, or technical decision.
version: 0.1.0
---

# Subagent Council

Run advisory deliberation through `codex-subagent`. Use this skill for decisions, tradeoffs, strategy, architecture, product framing, and ambiguous technical choices. A council is not a vote. It is an issue ledger, adversarial positions, rebuttal, and synthesis.

## Contract

- Keep Decision Owner authority with the user unless explicitly delegated.
- Use `context-pack/v1` with `mode: council`.
- Use `role-card/v1` for each role.
- Require `subagent-result/v1` structured output for every council role.
- Roles define capability and responsibility, not a fixed model.
- Preserve minority reports and domain vetoes.
- Do not convert consensus into authorization to implement, merge, or ship.

For context and role details, read `../references/context-and-roles.md` when needed.

## Default Roles

- `architect`: boundaries, ownership, governance, reversibility.
- `critic`: failure modes, hidden assumptions, security/safety concerns.
- `technician`: feasibility, implementation constraints, timeline realism.
- `pragmatist`: scope discipline, MVP cut lines, cost of delay.
- `engineer`: concrete build path, edge cases, testability.

## Protocol

1. Define the decision question and success criteria.
2. Build a context pack:

```bash
codex-subagent context build \
  --subject "<decision>" \
  --mode council \
  --goal "Map tradeoffs and recommend a direction" \
  --rule AGENTS.md \
  --file decision.md \
  --out context.json
```

3. Run independent first-pass positions as a panel:

```bash
codex-subagent panel run pi \
  --context-pack context.json \
  --role architect \
  --role critic \
  --role technician \
  --role pragmatist \
  --role engineer

codex-subagent panel results <panel-id> --structured
```

4. Inspect outputs and create an issue ledger:
   - issue id
   - title
   - severity
   - supporting roles
   - opposing roles
   - evidence
   - unresolved question
5. Run one focused rebuttal pass only when disagreement remains decision-relevant.
6. Synthesize:
   - decision options
   - risks
   - reversible vs irreversible choices
   - domain vetoes
   - recommended direction
   - required user decision

## Output

Return:

- council status: `assessed`, `partial`, or `not_assessed`
- issue ledger
- role positions
- strongest objections
- recommended decision
- explicit Decision Owner question
