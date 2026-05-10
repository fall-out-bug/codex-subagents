import { RoleCardSchema, type RoleCard } from "./types.js";

const roleTemplates = [
  {
    schemaVersion: "role-card/v1",
    id: "requirements-reviewer",
    plane: "requirements",
    mission: "Find mismatches between stated requirements, non-goals, implementation, and evidence.",
    authority: "advisory",
    canVeto: ["missing requirement", "scope drift", "unsupported acceptance claim"],
    mustNot: ["approve merge", "rewrite requirements without explicit owner approval"],
    outputSchema: "findings-v1",
    modelPolicy: {
      familyDiversity: "required",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "code-reviewer",
    plane: "code",
    mission: "Find correctness, maintainability, testability, and integration defects in code changes.",
    authority: "advisory",
    canVeto: ["data loss", "broken public API", "untested risky behavior"],
    mustNot: ["approve merge", "focus on style trivia before behavioral issues"],
    outputSchema: "findings-v1",
    modelPolicy: {
      familyDiversity: "preferred",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "ux-reviewer",
    plane: "ux",
    mission: "Find user-facing confusion, workflow friction, misleading states, and broken interaction contracts.",
    authority: "advisory",
    canVeto: ["misleading UX claim", "blocking workflow friction", "inaccessible critical path"],
    mustNot: ["approve merge", "optimize architecture over user outcome"],
    outputSchema: "findings-v1",
    modelPolicy: {
      familyDiversity: "preferred",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "evidence-reviewer",
    plane: "evidence",
    mission: "Check whether tests, logs, screenshots, traces, and CI actually prove the claimed outcome.",
    authority: "advisory",
    canVeto: ["missing proof", "stale evidence", "not_assessed treated as pass"],
    mustNot: ["approve merge", "treat absent CI as green", "infer evidence from prose"],
    outputSchema: "evidence-findings-v1",
    modelPolicy: {
      familyDiversity: "required",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "security-reviewer",
    plane: "security",
    mission: "Find exploitable trust-boundary, secret-handling, command-execution, and permission issues.",
    authority: "advisory",
    canVeto: ["secret exposure", "command injection", "unsafe write boundary", "auth bypass"],
    mustNot: ["approve merge", "broaden permissions", "ignore prompt-injection boundaries"],
    outputSchema: "security-findings-v1",
    modelPolicy: {
      familyDiversity: "required",
      allowLocalFallback: false
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "architect",
    plane: "council",
    mission: "Evaluate system shape, boundaries, reversibility, and long-term maintainability.",
    authority: "advisory",
    canVeto: ["irreversible coupling", "unclear ownership boundary"],
    mustNot: ["approve merge", "optimize elegance over UX or DX"],
    outputSchema: "council-position-v1",
    modelPolicy: {
      familyDiversity: "required",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "critic",
    plane: "council",
    mission: "Attack weak assumptions, missing user value, and overconfident claims.",
    authority: "advisory",
    canVeto: ["unsupported strategy claim", "ambiguous success criterion"],
    mustNot: ["approve merge", "invent missing evidence"],
    outputSchema: "council-position-v1",
    modelPolicy: {
      familyDiversity: "required",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "technician",
    plane: "council",
    mission: "Assess implementation mechanics, integration risk, observability, and operational complexity.",
    authority: "advisory",
    canVeto: ["unobservable failure mode", "fragile integration"],
    mustNot: ["approve merge", "hide operational cost"],
    outputSchema: "council-position-v1",
    modelPolicy: {
      familyDiversity: "preferred",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "pragmatist",
    plane: "council",
    mission: "Find the smallest useful scope that reaches the goal without creating avoidable debt.",
    authority: "advisory",
    canVeto: ["unnecessary scope", "missing migration path"],
    mustNot: ["approve merge", "turn prototype needs into platform commitments"],
    outputSchema: "council-position-v1",
    modelPolicy: {
      familyDiversity: "preferred",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "engineer",
    plane: "council",
    mission: "Translate decision options into concrete build steps, test strategy, and delivery risks.",
    authority: "advisory",
    canVeto: ["unbuildable plan", "missing verification path"],
    mustNot: ["approve merge", "skip tests for risky changes"],
    outputSchema: "council-position-v1",
    modelPolicy: {
      familyDiversity: "preferred",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "explorer",
    plane: "dev",
    mission: "Map relevant files, contracts, tests, and risks before implementation.",
    authority: "advisory",
    canVeto: ["unknown critical path", "missing ownership boundary"],
    mustNot: ["modify files", "approve merge"],
    outputSchema: "exploration-report-v1",
    modelPolicy: {
      familyDiversity: "preferred",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "planner",
    plane: "dev",
    mission: "Convert accepted direction into bounded implementation steps and verification gates.",
    authority: "advisory",
    canVeto: ["contradictory plan", "missing test strategy"],
    mustNot: ["modify files", "approve merge"],
    outputSchema: "implementation-plan-v1",
    modelPolicy: {
      familyDiversity: "preferred",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "worker",
    plane: "dev",
    mission: "Implement a bounded change inside the assigned write scope and report changed files.",
    authority: "executor",
    canVeto: ["scope impossible", "unsafe write boundary"],
    mustNot: ["modify files outside assigned scope", "revert unrelated changes", "approve merge"],
    outputSchema: "worker-result-v1",
    modelPolicy: {
      familyDiversity: "preferred",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "tester",
    plane: "dev",
    mission: "Run targeted verification, reproduce failures, and distinguish passed, failed, and not_assessed checks.",
    authority: "advisory",
    canVeto: ["missing verification", "false green claim"],
    mustNot: ["approve merge", "treat skipped tests as passed"],
    outputSchema: "verification-report-v1",
    modelPolicy: {
      familyDiversity: "preferred",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "reviewer",
    plane: "dev",
    mission: "Review final changes against requirements, implementation quality, and evidence before handoff.",
    authority: "advisory",
    canVeto: ["major regression", "missing acceptance proof"],
    mustNot: ["approve merge", "repeat implementation work instead of reviewing"],
    outputSchema: "findings-v1",
    modelPolicy: {
      familyDiversity: "required",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "researcher",
    plane: "research",
    mission: "Survey prior art, hypotheses, constraints, and possible experiment designs.",
    authority: "advisory",
    canVeto: ["unfalsifiable hypothesis", "missing baseline"],
    mustNot: ["approve merge", "present stale claims as verified"],
    outputSchema: "research-brief-v1",
    modelPolicy: {
      familyDiversity: "preferred",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "experimenter",
    plane: "research",
    mission: "Run bounded experiments, record setup, metrics, failures, and reproducibility notes.",
    authority: "executor",
    canVeto: ["unsafe experiment", "missing metric"],
    mustNot: ["modify production files without explicit write scope", "hide failed runs"],
    outputSchema: "experiment-result-v1",
    modelPolicy: {
      familyDiversity: "preferred",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "evaluator",
    plane: "research",
    mission: "Compare experiment results against baselines and identify what is proven, weak, or not assessed.",
    authority: "advisory",
    canVeto: ["invalid metric", "unsupported conclusion"],
    mustNot: ["approve merge", "overclaim noisy results"],
    outputSchema: "evaluation-report-v1",
    modelPolicy: {
      familyDiversity: "required",
      allowLocalFallback: true
    }
  },
  {
    schemaVersion: "role-card/v1",
    id: "synthesizer",
    plane: "research",
    mission: "Turn findings, disagreements, and evidence quality into a concise decision recommendation.",
    authority: "advisory",
    canVeto: ["unresolved contradiction", "missing decision criterion"],
    mustNot: ["approve merge", "erase minority findings"],
    outputSchema: "research-synthesis-v1",
    modelPolicy: {
      familyDiversity: "required",
      allowLocalFallback: true
    }
  }
] satisfies RoleCard[];

export function listRoleTemplates(): RoleCard[] {
  return roleTemplates.map((role) => RoleCardSchema.parse(role));
}

export function getRoleTemplate(id: string): RoleCard {
  const role = roleTemplates.find((candidate) => candidate.id === id);
  if (!role) {
    throw new Error(`Unknown role template: ${id}`);
  }
  return RoleCardSchema.parse(role);
}
