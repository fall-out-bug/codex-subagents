---
name: subagent-review
description: This skill should be used when the user asks for "multi-plane review", "review with different LLMs", "pi/opencode review panel", "review code/spec/idea through subagents", or wants independent reviewers for code, product, UX, evidence, security, or requirements.
version: 0.1.0
---

# Subagent Review

Run independent review planes through `codex-subagent`. Keep this skill read-only by default. Use it for code, specs, product ideas, prose, implementation evidence, and PRs where one blended opinion would hide disagreement.

## Contract

- Use one `context-pack/v1` for the shared target.
- Use one `role-card/v1` per review plane.
- Require `subagent-result/v1` structured output for every reviewer.
- Keep each reviewer independent. Do not include other reviewers' conclusions in the first pass.
- Treat missing tests, CI, screenshots, or runtime proof as `not_assessed`.
- Do not treat reviewer output as approval to merge, ship, or widen scope.
- Preserve reviewer conflicts instead of flattening them into a false consensus.

For context and role details, read `../references/context-and-roles.md` when needed.

## Review Plan

1. Identify the target: diff, branch, files, spec, PR, idea, or artifact.
2. Define planes. Prefer 3-5 focused planes:
   - `requirements`: match against stated goal and acceptance criteria.
   - `code`: correctness, maintainability, edge cases.
   - `ux`: user path, wording, friction, expectation mismatch.
   - `evidence`: tests, CI, logs, screenshots, reproducibility.
   - `security`: secrets, command execution, auth, filesystem boundaries.
3. Build a context pack:

```bash
codex-subagent context build \
  --subject "<target>" \
  --mode review \
  --goal "<review goal>" \
  --file <path> \
  --rule AGENTS.md \
  --diff \
  --out context.json
```

4. Run the panel with built-in advisory role templates:

```bash
codex-subagent panel run pi \
  --context-pack context.json \
  --role requirements-reviewer \
  --role code-reviewer \
  --role evidence-reviewer \
  --role security-reviewer
```

5. Aggregate structured results:

```bash
codex-subagent panel results <panel-id> --structured
```

6. Inspect child runs when a role is failed, partial, empty, or surprising:

```bash
codex-subagent inspect <run-id>
codex-subagent logs <run-id> --stream stderr
codex-subagent result <run-id> --structured
```

7. Synthesize findings by severity and evidence. Mark unusable, empty, hung, or off-task reviewer output as `not_assessed`.

## Output

Return:

- review status: `assessed`, `partial`, or `not_assessed`
- reviewer table: role, model/runtime, status, run id
- findings: `critical`, `major`, `minor`
- conflicts between reviewers
- evidence gaps
- recommended next action
