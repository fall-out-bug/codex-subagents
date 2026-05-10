import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { readContextPack, renderTaskFromContext } from "./context.js";
import { panelsRoot } from "./paths.js";
import { readStatus } from "./registry.js";
import { parseStructuredResult } from "./results.js";
import { runSubagent, startSubagent } from "./runner.js";
import { getRoleTemplate } from "./roles.js";
import { RuntimeSchema, type RuntimeName, type StructuredResult } from "./types.js";

export type PanelRun = {
  roleId: string;
  runId: string;
  state: string;
  statusPath: string;
};

export type SubagentPanel = {
  schemaVersion: "subagent-panel/v1";
  id: string;
  runtime: RuntimeName;
  contextPackPath: string;
  background: boolean;
  createdAt: string;
  runs: PanelRun[];
};

export type RunPanelOptions = {
  runtime: RuntimeName;
  cwd: string;
  contextPackPath: string;
  roleIds: string[];
  profile?: string;
  agent?: string;
  model?: string;
  timeoutMs: number;
  background?: boolean;
  pathPrefix?: string;
};

export async function runPanel(options: RunPanelOptions): Promise<SubagentPanel> {
  if (options.roleIds.length === 0) {
    throw new Error("Provide at least one --role");
  }

  const runtime = RuntimeSchema.parse(options.runtime);
  const contextPack = await readContextPack(options.contextPackPath);
  const id = `panel_${nanoid(10)}`;

  const runs = await Promise.all(options.roleIds.map(async (roleId) => {
    const roleCard = getRoleTemplate(roleId);
    const task = [
      `Panel: ${id}`,
      "",
      "Role-bound task:",
      renderTaskFromContext({ contextPack, roleCard })
    ].join("\n");

    const result = options.background
      ? await startSubagent({
          runtime,
          cwd: options.cwd,
          task,
          profile: options.profile,
          agent: options.agent,
          model: options.model,
          timeoutMs: options.timeoutMs,
          pathPrefix: options.pathPrefix
        })
      : await runSubagent({
          runtime,
          cwd: options.cwd,
          task,
          profile: options.profile,
          agent: options.agent,
          model: options.model,
          timeoutMs: options.timeoutMs,
          pathPrefix: options.pathPrefix
        });
    const status = await readStatus(options.cwd, result.id);
    return {
      roleId,
      runId: result.id,
      state: status.state,
      statusPath: result.statusPath
    };
  }));

  const panel: SubagentPanel = {
    schemaVersion: "subagent-panel/v1",
    id,
    runtime,
    contextPackPath: options.contextPackPath,
    background: options.background ?? false,
    createdAt: new Date().toISOString(),
    runs
  };
  await writePanel(options.cwd, panel);
  return panel;
}

export async function readPanel(cwd: string, id: string): Promise<SubagentPanel> {
  const panel = JSON.parse(await readFile(panelPath(cwd, id), "utf8")) as SubagentPanel;
  return refreshPanel(cwd, panel);
}

export async function readPanelResults(cwd: string, id: string, structured: boolean): Promise<unknown> {
  const panel = await readPanel(cwd, id);
  const runs = await Promise.all(panel.runs.map(async (run) => {
    const status = await readStatus(cwd, run.runId);
    const raw = await readFile(status.resultPath, "utf8");
    return {
      roleId: run.roleId,
      runId: run.runId,
      state: status.state,
      result: structured ? parseStructuredResult(raw) : raw
    };
  }));

  return {
    schemaVersion: "subagent-panel-results/v1",
    id: panel.id,
    runtime: panel.runtime,
    summary: structured ? summarizeStructuredPanel(runs as Array<{
      roleId: string;
      runId: string;
      state: string;
      result: StructuredResult;
    }>) : undefined,
    runs
  };
}

async function writePanel(cwd: string, panel: SubagentPanel): Promise<void> {
  await mkdir(panelsRoot(cwd), { recursive: true });
  await writeFile(panelPath(cwd, panel.id), `${JSON.stringify(panel, null, 2)}\n`);
}

async function refreshPanel(cwd: string, panel: SubagentPanel): Promise<SubagentPanel> {
  const runs = await Promise.all(panel.runs.map(async (run) => {
    try {
      const status = await readStatus(cwd, run.runId);
      return {
        ...run,
        state: status.state
      };
    } catch {
      return run;
    }
  }));
  const refreshed = { ...panel, runs };
  await writePanel(cwd, refreshed);
  return refreshed;
}

function panelPath(cwd: string, id: string): string {
  return path.join(panelsRoot(cwd), `${id}.json`);
}

function summarizeStructuredPanel(runs: Array<{
  roleId: string;
  state: string;
  result: StructuredResult;
}>): unknown {
  const severityCounts = { critical: 0, major: 0, minor: 0 };
  const evidenceGaps: string[] = [];
  let parsed = 0;
  let hasFail = false;
  let hasPartial = false;

  for (const run of runs) {
    if (run.result.structured) {
      parsed += 1;
    } else {
      evidenceGaps.push(run.roleId);
    }

    if (run.result.evidence.length === 0) {
      evidenceGaps.push(run.roleId);
    }

    for (const finding of run.result.findings) {
      severityCounts[finding.severity] += 1;
    }

    if (run.state === "fail" || run.result.status === "fail") {
      hasFail = true;
    }

    if (
      run.state === "partial" ||
      run.state === "not_assessed" ||
      run.result.status === "partial" ||
      run.result.status === "not_assessed" ||
      !run.result.structured
    ) {
      hasPartial = true;
    }
  }

  return {
    status: hasFail ? "fail" : hasPartial ? "partial" : "pass",
    structured: {
      total: runs.length,
      parsed,
      unstructured: runs.length - parsed
    },
    severityCounts,
    evidenceGaps: [...new Set(evidenceGaps)]
  };
}
