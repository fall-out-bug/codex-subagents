import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { spawn } from "node:child_process";
import { nanoid } from "nanoid";
import { adapterFor } from "./adapters.js";
import { appendEvent } from "./events.js";
import { prepareExecutionCwd, type IsolationMode } from "./isolation.js";
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
  pathPrefix?: string;
  isolate?: IsolationMode;
};

export async function runSubagent(options: RunOptions): Promise<{ id: string; statusPath: string }> {
  const request = await buildRequest(options);

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
    await appendEvent(request.cwd, request.id, {
      type: "process.started",
      message: `Started ${command.command}`,
      data: { command: command.command, args: command.args }
    });
    const result = await execa(command.command, command.args, {
      cwd: request.executionCwd ?? request.cwd,
      env: envFor(command.env, options.pathPrefix),
      timeout: request.timeoutMs,
      reject: false,
      all: false
    });

    stdout = result.stdout;
    stderr = result.stderr;
    exitCode = result.exitCode ?? null;
    await appendEvent(request.cwd, request.id, {
      type: "process.finished",
      message: `Finished ${command.command}`,
      data: { exitCode }
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    exitCode = 1;
    await appendEvent(request.cwd, request.id, {
      type: "process.failed",
      message: `Failed ${command.command}`,
      data: { error: errorMessage }
    });
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

export async function startSubagent(options: RunOptions): Promise<{ id: string; statusPath: string }> {
  const request = await buildRequest(options);
  const dir = await createRunFiles(request);
  const command = adapterFor(request.runtime).buildCommand(request);
  const monitorPath = path.join(dir, "monitor.mjs");

  await writeFile(monitorPath, monitorScript({
    command: command.command,
    args: command.args,
    cwd: request.executionCwd ?? request.cwd,
    env: envFor(command.env, options.pathPrefix),
    stdoutPath: path.join(dir, "stdout.log"),
    stderrPath: path.join(dir, "stderr.log"),
    resultPath: path.join(dir, "result.md"),
    statusPath: path.join(dir, "status.json"),
    eventsPath: path.join(dir, "events.jsonl"),
    runId: request.id,
    timeoutMs: request.timeoutMs
  }));

  const child = spawn(process.execPath, [monitorPath], {
    cwd: request.cwd,
    detached: true,
    stdio: "ignore",
    env: envFor(command.env, options.pathPrefix)
  });

  child.unref();

  const statusPath = path.join(dir, "status.json");
  const previous = await readStatus(request.cwd, request.id);
  await appendEvent(request.cwd, request.id, {
    type: "monitor.started",
    message: "Started background monitor",
    data: { pid: child.pid ?? null, command: command.command, args: command.args }
  });
  await updateStatus(request.cwd, {
    ...previous,
    pid: child.pid ?? null,
    background: true
  });

  return { id: request.id, statusPath };
}

export async function cancelRun(cwd: string, id: string): Promise<Awaited<ReturnType<typeof readStatus>>> {
  const status = await readStatus(cwd, id);

  if (status.state !== "running") {
    return status;
  }

  if (status.pid) {
    try {
      process.kill(-status.pid, "SIGTERM");
    } catch {
      try {
        process.kill(status.pid, "SIGTERM");
      } catch {
        // The process may have exited between status read and cancellation.
      }
    }
  }

  const updated = {
    ...status,
    state: "cancelled" as const,
    exitCode: null,
    finishedAt: new Date().toISOString()
  };
  await updateStatus(cwd, updated);
  return updated;
}

async function buildRequest(options: RunOptions): Promise<RunRequest> {
  const id = nanoid(10);
  const executionCwd = await prepareExecutionCwd({
    cwd: options.cwd,
    id,
    isolate: options.isolate
  });

  return {
    id,
    runtime: options.runtime,
    cwd: options.cwd,
    executionCwd,
    task: options.task,
    profile: options.profile,
    agent: options.agent,
    model: options.model,
    timeoutMs: options.timeoutMs,
    createdAt: new Date().toISOString()
  };
}

function normalizeResult(stdout: string, stderr: string): string {
  const body = stdout.trim() || stderr.trim() || "No output captured.";
  return `${body}\n`;
}

function envFor(extra?: Record<string, string>, pathPrefix?: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...extra,
    PATH: pathPrefix ? `${pathPrefix}:${process.env.PATH ?? ""}` : process.env.PATH
  };
}

function monitorScript(config: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdoutPath: string;
  stderrPath: string;
  resultPath: string;
  statusPath: string;
  eventsPath: string;
  runId: string;
  timeoutMs: number;
}): string {
  return `import { spawn } from "node:child_process";
import { createWriteStream, readFileSync, writeFileSync } from "node:fs";

const config = ${JSON.stringify(config)};
let child = null;
let finished = false;

function readStatus() {
  return JSON.parse(readFileSync(config.statusPath, "utf8"));
}

function writeStatus(patch) {
  const current = readStatus();
  writeFileSync(config.statusPath, JSON.stringify({ ...current, ...patch }, null, 2) + "\\n");
}

function appendEvent(type, message, data = {}) {
  writeFileSync(config.eventsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    runId: config.runId,
    type,
    message,
    data
  }) + "\\n", { flag: "a" });
}

function normalizeResult(stdout, stderr) {
  const body = stdout.trim() || stderr.trim() || "No output captured.";
  return body + "\\n";
}

function finish(state, exitCode, error = null) {
  if (finished) return;
  finished = true;
  const stdout = safeRead(config.stdoutPath);
  const stderr = safeRead(config.stderrPath);
  writeFileSync(config.resultPath, normalizeResult(stdout, stderr));
  const current = readStatus();
  if (current.state !== "running") return;
  writeStatus({
    state,
    exitCode,
    finishedAt: new Date().toISOString(),
    error
  });
}

function safeRead(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

process.on("SIGTERM", () => {
  appendEvent("process.cancelled", "Received cancellation signal");
  if (child?.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      try { child.kill("SIGTERM"); } catch {}
    }
  }
  finish("cancelled", null);
  process.exit(0);
});

const stdout = createWriteStream(config.stdoutPath, { flags: "a" });
const stderr = createWriteStream(config.stderrPath, { flags: "a" });
const timeout = setTimeout(() => {
  appendEvent("process.timeout", "Process timed out", { timeoutMs: config.timeoutMs });
  if (child?.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      try { child.kill("SIGTERM"); } catch {}
    }
  }
  finish("fail", null, "Timed out after " + config.timeoutMs + "ms");
  process.exit(1);
}, config.timeoutMs);

child = spawn(config.command, config.args, {
  cwd: config.cwd,
  env: config.env,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"]
});
appendEvent("process.started", "Started " + config.command, { command: config.command, args: config.args, pid: child.pid });

child.stdout.pipe(stdout);
child.stderr.pipe(stderr);

child.once("error", (error) => {
  clearTimeout(timeout);
  stderr.write(String(error?.message || error));
  appendEvent("process.failed", "Failed " + config.command, { error: String(error?.message || error) });
  finish("fail", 1, String(error?.message || error));
  process.exit(1);
});

child.once("exit", (exitCode) => {
  clearTimeout(timeout);
  appendEvent("process.finished", "Finished " + config.command, { exitCode });
  stdout.end(() => {
    stderr.end(() => {
      finish(exitCode === 0 ? "pass" : "fail", exitCode);
      process.exit(exitCode ?? 1);
    });
  });
});
`;
}
