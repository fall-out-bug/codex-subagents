import { z } from "zod";

export const RuntimeSchema = z.enum(["pi", "opencode", "gsd2"]);
export type RuntimeName = z.infer<typeof RuntimeSchema>;

export const RunStateSchema = z.enum([
  "running",
  "pass",
  "fail",
  "partial",
  "not_assessed",
  "cancelled"
]);
export type RunState = z.infer<typeof RunStateSchema>;

export const RequestSchema = z.object({
  id: z.string(),
  runtime: RuntimeSchema,
  cwd: z.string(),
  executionCwd: z.string().optional(),
  task: z.string(),
  profile: z.string().optional(),
  agent: z.string().optional(),
  model: z.string().optional(),
  timeoutMs: z.number().int().positive(),
  createdAt: z.string()
});
export type RunRequest = z.infer<typeof RequestSchema>;

export const StatusSchema = z.object({
  id: z.string(),
  runtime: RuntimeSchema,
  state: RunStateSchema,
  exitCode: z.number().int().nullable(),
  pid: z.number().int().positive().nullable().optional(),
  background: z.boolean().optional(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  resultPath: z.string(),
  error: z.string().nullable()
});
export type RunStatus = z.infer<typeof StatusSchema>;

export type LaunchCommand = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

export type RuntimeAdapter = {
  name: RuntimeName;
  buildCommand(request: RunRequest): LaunchCommand;
};

export const RunEventSchema = z.object({
  timestamp: z.string(),
  runId: z.string(),
  type: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).optional()
});
export type RunEvent = z.infer<typeof RunEventSchema>;

export const ContextModeSchema = z.enum(["review", "council", "dev", "research"]);
export type ContextMode = z.infer<typeof ContextModeSchema>;

export const ContextArtifactSchema = z.object({
  kind: z.enum(["file", "rule", "diff", "evidence", "note"]),
  path: z.string().nullable(),
  sha256: z.string().optional(),
  content: z.string(),
  trusted: z.boolean()
});
export type ContextArtifact = z.infer<typeof ContextArtifactSchema>;

export const ContextPackSchema = z.object({
  schemaVersion: z.literal("context-pack/v1"),
  subject: z.string(),
  mode: ContextModeSchema,
  goal: z.string(),
  nonGoals: z.array(z.string()),
  cwd: z.string(),
  createdAt: z.string(),
  artifacts: z.array(ContextArtifactSchema),
  budget: z.object({
    maxBytes: z.number().int().positive(),
    bytesUsed: z.number().int().nonnegative(),
    omitted: z.array(z.string())
  }),
  trust: z.object({
    untrustedArtifactKinds: z.array(z.string()),
    writeAllowed: z.boolean()
  })
});
export type ContextPack = z.infer<typeof ContextPackSchema>;

export const RoleCardSchema = z.object({
  schemaVersion: z.literal("role-card/v1"),
  id: z.string(),
  plane: z.string(),
  mission: z.string(),
  authority: z.enum(["advisory", "executor", "decision_owner"]),
  canVeto: z.array(z.string()).default([]),
  mustNot: z.array(z.string()).default([]),
  outputSchema: z.string(),
  modelPolicy: z.object({
    familyDiversity: z.enum(["none", "preferred", "required"]).default("preferred"),
    allowLocalFallback: z.boolean().default(true)
  }).default({
    familyDiversity: "preferred",
    allowLocalFallback: true
  })
});
export type RoleCard = z.infer<typeof RoleCardSchema>;

export const StructuredFindingSchema = z.object({
  severity: z.enum(["critical", "major", "minor"]),
  title: z.string(),
  body: z.string(),
  evidence: z.array(z.string()).default([]),
  recommendation: z.string().optional()
});
export type StructuredFinding = z.infer<typeof StructuredFindingSchema>;

export const StructuredResultSchema = z.object({
  schemaVersion: z.literal("subagent-result/v1"),
  status: RunStateSchema.exclude(["running", "cancelled"]),
  summary: z.string(),
  findings: z.array(StructuredFindingSchema).default([]),
  evidence: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
  structured: z.boolean().default(true),
  rawText: z.string().optional()
});
export type StructuredResult = z.infer<typeof StructuredResultSchema>;
