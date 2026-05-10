import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { nanoid } from "nanoid";
import { prepareExecutionCwd } from "./isolation.js";
import { autoresearchRunDir, runResultPath } from "./paths.js";
import { parseStructuredResult } from "./results.js";
import { runSubagent } from "./runner.js";
import { RuntimeSchema, type RuntimeName, type StructuredResult } from "./types.js";

export type Metric = {
  score: number;
  [key: string]: unknown;
};

export type AutoresearchExperiment = {
  candidate: number;
  runId: string;
  state: string;
  executionCwd: string;
  result: StructuredResult;
  metric: Metric;
};

export type AutoresearchRun = {
  schemaVersion: "autoresearch-run/v1";
  id: string;
  runtime: RuntimeName;
  programPath: string;
  metricCommand: string;
  candidates: number;
  createdAt: string;
  experiments: AutoresearchExperiment[];
  best: AutoresearchExperiment | null;
};

export type AutoresearchOptions = {
  cwd: string;
  runtime: RuntimeName;
  programPath: string;
  metricCommand: string;
  candidates: number;
  timeoutMs: number;
  pathPrefix?: string;
  model?: string;
  profile?: string;
};

export async function runAutoresearch(options: AutoresearchOptions): Promise<AutoresearchRun> {
  const runtime = RuntimeSchema.parse(options.runtime);
  if (options.candidates <= 0 || !Number.isInteger(options.candidates)) {
    throw new Error("--candidates must be a positive integer");
  }

  const id = `research_${nanoid(10)}`;
  const dir = autoresearchRunDir(options.cwd, id);
  await mkdir(dir, { recursive: true });
  const program = await readFile(options.programPath, "utf8");
  await writeFile(path.join(dir, "program.md"), program);

  const experiments: AutoresearchExperiment[] = [];

  for (let candidate = 1; candidate <= options.candidates; candidate += 1) {
    const executionCwd = await prepareExecutionCwd({
      cwd: options.cwd,
      id: `${id}/candidate-${candidate}`,
      isolate: "worktree"
    });

    if (!executionCwd) {
      throw new Error("Autoresearch requires worktree isolation");
    }

    const task = renderCandidateTask({
      id,
      candidate,
      program,
      metricCommand: options.metricCommand
    });
    const run = await runSubagent({
      runtime,
      cwd: options.cwd,
      task,
      timeoutMs: options.timeoutMs,
      pathPrefix: options.pathPrefix,
      model: options.model,
      profile: options.profile,
      executionCwd
    });
    const resultText = await readFile(runResultPath(options.cwd, run.id), "utf8");
    const result = parseStructuredResult(resultText);
    const metric = await runMetric(executionCwd, options.metricCommand);
    const experiment: AutoresearchExperiment = {
      candidate,
      runId: run.id,
      state: metric.score > Number.NEGATIVE_INFINITY && result.status !== "fail" ? "pass" : "fail",
      executionCwd,
      result,
      metric
    };
    experiments.push(experiment);
    await writeFile(path.join(dir, "experiments.jsonl"), `${JSON.stringify(experiment)}\n`, { flag: "a" });
  }

  const best = experiments
    .filter((experiment) => experiment.state === "pass")
    .sort((a, b) => b.metric.score - a.metric.score)[0] ?? null;

  const output: AutoresearchRun = {
    schemaVersion: "autoresearch-run/v1",
    id,
    runtime,
    programPath: options.programPath,
    metricCommand: options.metricCommand,
    candidates: options.candidates,
    createdAt: new Date().toISOString(),
    experiments,
    best
  };
  await writeFile(path.join(dir, "result.json"), `${JSON.stringify(output, null, 2)}\n`);
  return output;
}

function renderCandidateTask(input: {
  id: string;
  candidate: number;
  program: string;
  metricCommand: string;
}): string {
  return [
    `Autoresearch run: ${input.id}`,
    `Candidate: candidate ${input.candidate}`,
    "",
    "Program:",
    input.program,
    "",
    "Instructions:",
    "- Make one bounded candidate change inside the current worktree.",
    "- Do not modify program.md, skills, publishing config, or unrelated files.",
    "- Do not merge, publish, deploy, or claim success without metric evidence.",
    `- The evaluator will run: ${input.metricCommand}`,
    "- End with subagent-result/v1 JSON."
  ].join("\n");
}

async function runMetric(cwd: string, command: string): Promise<Metric> {
  const result = await execa(command, {
    cwd,
    shell: true,
    reject: false
  });
  if (result.exitCode !== 0) {
    return { score: Number.NEGATIVE_INFINITY, exitCode: result.exitCode, stderr: result.stderr };
  }

  const parsed = JSON.parse(result.stdout.trim()) as Metric;
  if (typeof parsed.score !== "number") {
    throw new Error("Metric command must print JSON with numeric score");
  }
  return parsed;
}
