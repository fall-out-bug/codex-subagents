import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { Command } from "commander";
import { runAutoresearch } from "./autoresearch.js";
import { cancelRun, runSubagent, startSubagent } from "./runner.js";
import { readEvents } from "./events.js";
import type { IsolationMode } from "./isolation.js";
import { inspectRun, readRunLog, type LogName } from "./inspect.js";
import { readPanel, readPanelResults, runPanel } from "./panel.js";
import { listStatuses, readStatus } from "./registry.js";
import { parseStructuredResult } from "./results.js";
import { ContextModeSchema, RuntimeSchema } from "./types.js";
import {
  buildContextPack,
  readContextPack,
  readRoleCard,
  renderTaskFromContext
} from "./context.js";
import { getRoleTemplate, listRoleTemplates } from "./roles.js";

const program = new Command();

program
  .name("codex-subagent")
  .description("Launch pi, OpenCode, and GSD2 agents as external subagents from Codex.")
  .version("0.3.0");

program
  .command("run")
  .argument("<runtime>", "pi, opencode, or gsd2")
  .option("--task <text>", "Task prompt")
  .option("--task-file <path>", "Read task prompt from a file")
  .option("--context-pack <path>", "Read a context-pack/v1 JSON file")
  .option("--role-card <path>", "Read a role-card/v1 JSON file")
  .option("--role-template <id>", "Use a built-in role-card template")
  .option("--profile <name>", "Runtime profile, for example readonly or review")
  .option("--agent <name>", "OpenCode agent name")
  .option("--model <id>", "Model override")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("--timeout <seconds>", "Timeout in seconds", "900")
  .option("--background", "Start the subagent in the background")
  .option("--isolate <mode>", "Isolation mode: worktree or none", "none")
  .action(async (runtimeInput: string, options: Record<string, string | undefined>) => {
    const runtime = RuntimeSchema.parse(runtimeInput);
    const task = await resolveTask({
      task: options.task,
      taskFile: options.taskFile,
      contextPack: options.contextPack,
      roleCard: options.roleCard,
      roleTemplate: options.roleTemplate
    });
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

const context = program
  .command("context")
  .description("Build and inspect typed context packs");

context
  .command("build")
  .requiredOption("--subject <text>", "What this context is about")
  .requiredOption("--mode <mode>", "review, council, dev, or research")
  .requiredOption("--goal <text>", "Goal for the subagent")
  .option("--non-goal <text>", "Non-goal; can be repeated", collect, [])
  .option("--file <path>", "File to include; can be repeated", collect, [])
  .option("--rule <path>", "Rule file to include; can be repeated", collect, [])
  .option("--diff", "Include git diff against HEAD")
  .option("--write-allowed", "Mark context as write-capable")
  .option("--max-bytes <number>", "Context byte budget", "524288")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("--out <path>", "Write JSON to a file instead of stdout")
  .action(async (options: {
    subject: string;
    mode: string;
    goal: string;
    nonGoal: string[];
    file: string[];
    rule: string[];
    diff?: boolean;
    writeAllowed?: boolean;
    maxBytes: string;
    cwd: string;
    out?: string;
  }) => {
    const pack = await buildContextPack({
      cwd: options.cwd,
      subject: options.subject,
      mode: ContextModeSchema.parse(options.mode),
      goal: options.goal,
      nonGoals: options.nonGoal,
      files: options.file,
      includeDiff: options.diff ?? false,
      rulePaths: options.rule.length > 0 ? options.rule : undefined,
      writeAllowed: options.writeAllowed ?? false,
      maxBytes: Number(options.maxBytes)
    });
    await outputJson(pack, options.out);
  });

const role = program
  .command("role")
  .description("List, write, and validate role-card/v1 files");

role
  .command("list")
  .description("List built-in role-card templates")
  .action(() => {
    console.log(JSON.stringify(listRoleTemplates(), null, 2));
  });

role
  .command("show")
  .argument("<id>", "Built-in role template id")
  .description("Print a built-in role-card template")
  .action((id: string) => {
    console.log(JSON.stringify(getRoleTemplate(id), null, 2));
  });

role
  .command("write")
  .argument("<id>", "Built-in role template id")
  .option("--out <path>", "Write JSON to a file instead of stdout")
  .description("Write a built-in role-card template")
  .action(async (id: string, options: { out?: string }) => {
    await outputJson(getRoleTemplate(id), options.out);
  });

role
  .command("validate")
  .argument("<path>", "Role card JSON file")
  .action(async (filePath: string) => {
    console.log(JSON.stringify(await readRoleCard(filePath), null, 2));
  });

const panel = program
  .command("panel")
  .description("Run and inspect multi-role subagent panels");

panel
  .command("run")
  .argument("<runtime>", "pi, opencode, or gsd2")
  .requiredOption("--context-pack <path>", "Read a context-pack/v1 JSON file")
  .option("--role <id>", "Built-in role template id; can be repeated", collect, [])
  .option("--profile <name>", "Runtime profile, for example readonly or review")
  .option("--agent <name>", "OpenCode agent name")
  .option("--model <id>", "Model override")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("--timeout <seconds>", "Timeout in seconds per role", "900")
  .option("--background", "Start every role run in the background")
  .action(async (runtimeInput: string, options: {
    contextPack: string;
    role: string[];
    profile?: string;
    agent?: string;
    model?: string;
    cwd: string;
    timeout: string;
    background?: boolean;
  }) => {
    const timeoutSeconds = Number(options.timeout);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
      throw new Error("--timeout must be a positive number of seconds");
    }

    console.log(JSON.stringify(await runPanel({
      runtime: RuntimeSchema.parse(runtimeInput),
      cwd: options.cwd,
      contextPackPath: options.contextPack,
      roleIds: options.role,
      profile: options.profile,
      agent: options.agent,
      model: options.model,
      timeoutMs: Math.round(timeoutSeconds * 1000),
      background: options.background ?? false
    }), null, 2));
  });

panel
  .command("status")
  .argument("<id>", "Panel id")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (id: string, options: { cwd: string }) => {
    console.log(JSON.stringify(await readPanel(options.cwd, id), null, 2));
  });

panel
  .command("results")
  .argument("<id>", "Panel id")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("--structured", "Parse every child result as subagent-result/v1 JSON")
  .action(async (id: string, options: { cwd: string; structured?: boolean }) => {
    console.log(JSON.stringify(await readPanelResults(options.cwd, id, options.structured ?? false), null, 2));
  });

const autoresearch = program
  .command("autoresearch")
  .description("Run bounded self-improving experiment loops");

autoresearch
  .command("run")
  .argument("<runtime>", "pi, opencode, or gsd2")
  .requiredOption("--program <path>", "Research program markdown file")
  .requiredOption("--metric <command>", "Metric command; must print JSON with numeric score")
  .option("--candidates <number>", "Number of candidates to try", "3")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("--timeout <seconds>", "Timeout in seconds per candidate", "900")
  .option("--profile <name>", "Runtime profile")
  .option("--model <id>", "Model override")
  .action(async (runtimeInput: string, options: {
    program: string;
    metric: string;
    candidates: string;
    cwd: string;
    timeout: string;
    profile?: string;
    model?: string;
  }) => {
    const timeoutSeconds = Number(options.timeout);
    const candidates = Number(options.candidates);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
      throw new Error("--timeout must be a positive number of seconds");
    }
    if (!Number.isInteger(candidates) || candidates <= 0) {
      throw new Error("--candidates must be a positive integer");
    }
    console.log(JSON.stringify(await runAutoresearch({
      runtime: RuntimeSchema.parse(runtimeInput),
      cwd: options.cwd,
      programPath: options.program,
      metricCommand: options.metric,
      candidates,
      timeoutMs: Math.round(timeoutSeconds * 1000),
      profile: options.profile,
      model: options.model
    }), null, 2));
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
  .option("--structured", "Parse result as subagent-result/v1 JSON")
  .action(async (id: string, options: { cwd: string; structured?: boolean }) => {
    const status = await readStatus(options.cwd, id);
    const result = await readFile(status.resultPath, "utf8");
    if (options.structured) {
      console.log(JSON.stringify(parseStructuredResult(result), null, 2));
      return;
    }
    console.log(result);
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

async function resolveTask(options: {
  task?: string;
  taskFile?: string;
  contextPack?: string;
  roleCard?: string;
  roleTemplate?: string;
}): Promise<string> {
  const { task, taskFile, contextPack, roleCard, roleTemplate } = options;
  if (task && taskFile) {
    throw new Error("Use either --task or --task-file, not both");
  }

  if (roleCard && roleTemplate) {
    throw new Error("Use either --role-card or --role-template, not both");
  }

  if (roleTemplate && !contextPack) {
    throw new Error("--role-template requires --context-pack");
  }

  if ((contextPack || roleCard) && (taskFile || task)) {
    throw new Error("Use either task/task-file or context-pack/role-card/role-template, not both");
  }

  if (contextPack) {
    return renderTaskFromContext({
      contextPack: await readContextPack(contextPack),
      roleCard: roleCard
        ? await readRoleCard(roleCard)
        : roleTemplate
          ? getRoleTemplate(roleTemplate)
          : undefined
    });
  }

  if (taskFile) {
    return readFile(taskFile, "utf8");
  }

  if (task) {
    return task;
  }

  throw new Error("Provide --task or --task-file");
}

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

async function outputJson(value: unknown, out?: string): Promise<void> {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  if (out) {
    await writeFile(out, json);
    return;
  }
  console.log(json);
}

await program.parseAsync();
