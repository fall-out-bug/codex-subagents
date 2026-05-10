import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { nanoid } from "nanoid";
import { adapterFor } from "./adapters.js";
import { createRunFiles, readStatus, updateStatus } from "./registry.js";
import type { RunRequest, RuntimeName } from "./types.js";

export type RunOptions = {
  runtime: RuntimeName;
  cwd: string;
  task: string;
  profile?: string;
  agent?: string;
  model?: string;
  timeoutMs: number;
};

export async function runSubagent(options: RunOptions): Promise<{ id: string; statusPath: string }> {
  const request: RunRequest = {
    id: nanoid(10),
    runtime: options.runtime,
    cwd: options.cwd,
    task: options.task,
    profile: options.profile,
    agent: options.agent,
    model: options.model,
    timeoutMs: options.timeoutMs,
    createdAt: new Date().toISOString()
  };

  const dir = await createRunFiles(request);
  const command = adapterFor(request.runtime).buildCommand(request);

  const stdoutPath = path.join(dir, "stdout.log");
  const stderrPath = path.join(dir, "stderr.log");
  const resultPath = path.join(dir, "result.md");

  let stdout = "";
  let stderr = "";
  let exitCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    const result = await execa(command.command, command.args, {
      cwd: request.cwd,
      env: command.env,
      timeout: request.timeoutMs,
      reject: false,
      all: false
    });

    stdout = result.stdout;
    stderr = result.stderr;
    exitCode = result.exitCode ?? null;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    exitCode = 1;
  }

  await writeFile(stdoutPath, stdout);
  await writeFile(stderrPath, stderr);
  await writeFile(resultPath, normalizeResult(stdout, stderr));

  const previous = await readStatus(request.cwd, request.id);
  await updateStatus(request.cwd, {
    ...previous,
    state: exitCode === 0 ? "pass" : "fail",
    exitCode,
    finishedAt: new Date().toISOString(),
    error: errorMessage
  });

  return { id: request.id, statusPath: path.join(dir, "status.json") };
}

function normalizeResult(stdout: string, stderr: string): string {
  const body = stdout.trim() || stderr.trim() || "No output captured.";
  return `${body}\n`;
}
