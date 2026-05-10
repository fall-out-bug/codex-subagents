import { z } from "zod";

export const RuntimeSchema = z.enum(["pi", "opencode", "gsd2"]);
export type RuntimeName = z.infer<typeof RuntimeSchema>;

export const RunStateSchema = z.enum(["running", "pass", "fail", "partial", "not_assessed"]);
export type RunState = z.infer<typeof RunStateSchema>;

export const RequestSchema = z.object({
  id: z.string(),
  runtime: RuntimeSchema,
  cwd: z.string(),
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
