import { readFile } from "node:fs/promises";
import process from "node:process";
import { Command } from "commander";
import { cancelRun, runSubagent, startSubagent } from "./runner.js";
import { readEvents } from "./events.js";
import type { IsolationMode } from "./isolation.js";
import { inspectRun, readRunLog, type LogName } from "./inspect.js";
import { listStatuses, readStatus } from "./registry.js";
import { RuntimeSchema } from "./types.js";

const program = new Command();

program
  .name("codex-subagent")
  .description("Launch pi, OpenCode, and GSD2 agents as external subagents from Codex.")
  .version("0.2.0");

program
  .command("run")
  .argument("<runtime>", "pi, opencode, or gsd2")
  .option("--task <text>", "Task prompt")
  .option("--task-file <path>", "Read task prompt from a file")
  .option("--profile <name>", "Runtime profile, for example readonly or review")
  .option("--agent <name>", "OpenCode agent name")
  .option("--model <id>", "Model override")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("--timeout <seconds>", "Timeout in seconds", "900")
  .option("--background", "Start the subagent in the background")
  .option("--isolate <mode>", "Isolation mode: worktree or none", "none")
  .action(async (runtimeInput: string, options: Record<string, string | undefined>) => {
    const runtime = RuntimeSchema.parse(runtimeInput);
    const task = await resolveTask(options.task, options.taskFile);
    const timeoutSeconds = Number(options.timeout);

    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
      throw new Error("--timeout must be a positive number of seconds");
    }

    const isolate: IsolationMode = options.isolate === "worktree" ? "worktree" : "none";
    const runOptions = {
      runtime,
      cwd: options.cwd ?? process.cwd(),
      task,
      profile: options.profile,
      agent: options.agent,
      model: options.model,
      timeoutMs: Math.round(timeoutSeconds * 1000),
      isolate
    };

    const result = options.background
      ? await startSubagent(runOptions)
      : await runSubagent(runOptions);

    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("status")
  .argument("<id>", "Run id")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (id: string, options: { cwd: string }) => {
    console.log(JSON.stringify(await readStatus(options.cwd, id), null, 2));
  });

program
  .command("result")
  .argument("<id>", "Run id")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (id: string, options: { cwd: string }) => {
    const status = await readStatus(options.cwd, id);
    console.log(await readFile(status.resultPath, "utf8"));
  });

program
  .command("inspect")
  .argument("<id>", "Run id")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (id: string, options: { cwd: string }) => {
    console.log(JSON.stringify(await inspectRun(options.cwd, id), null, 2));
  });

program
  .command("logs")
  .argument("<id>", "Run id")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("--stream <name>", "stdout or stderr", "stdout")
  .action(async (id: string, options: { cwd: string; stream: string }) => {
    const stream = options.stream === "stderr" ? "stderr" : "stdout";
    console.log(await readRunLog(options.cwd, id, stream as LogName));
  });

program
  .command("events")
  .argument("<id>", "Run id")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (id: string, options: { cwd: string }) => {
    console.log(JSON.stringify(await readEvents(options.cwd, id), null, 2));
  });

program
  .command("cancel")
  .argument("<id>", "Run id")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (id: string, options: { cwd: string }) => {
    console.log(JSON.stringify(await cancelRun(options.cwd, id), null, 2));
  });

program
  .command("list")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (options: { cwd: string }) => {
    console.log(JSON.stringify(await listStatuses(options.cwd), null, 2));
  });

async function resolveTask(task?: string, taskFile?: string): Promise<string> {
  if (task && taskFile) {
    throw new Error("Use either --task or --task-file, not both");
  }

  if (taskFile) {
    return readFile(taskFile, "utf8");
  }

  if (task) {
    return task;
  }

  throw new Error("Provide --task or --task-file");
}

await program.parseAsync();
