import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { appendEvent } from "./events.js";
import { runDir, runsRoot } from "./paths.js";
import { RequestSchema, StatusSchema, type RunRequest, type RunStatus } from "./types.js";

export async function createRunFiles(request: RunRequest): Promise<string> {
  const dir = runDir(request.cwd, request.id);
  await mkdir(dir, { recursive: true });
  await writeJson(path.join(dir, "request.json"), request);
  await writeJson(path.join(dir, "status.json"), {
    id: request.id,
    runtime: request.runtime,
    state: "running",
    exitCode: null,
    pid: null,
    background: false,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    resultPath: path.join(dir, "result.md"),
    error: null
  } satisfies RunStatus);
  await appendEvent(request.cwd, request.id, {
    type: "run.created",
    message: `Created ${request.runtime} run`,
    data: {
      runtime: request.runtime,
      profile: request.profile,
      agent: request.agent,
      model: request.model,
      cwd: request.cwd,
      timeoutMs: request.timeoutMs
    }
  });
  return dir;
}

export async function updateStatus(cwd: string, status: RunStatus): Promise<void> {
  await writeJson(path.join(runDir(cwd, status.id), "status.json"), status);
}

export async function readRequest(cwd: string, id: string): Promise<RunRequest> {
  const raw = await readFile(path.join(runDir(cwd, id), "request.json"), "utf8");
  return RequestSchema.parse(JSON.parse(raw));
}

export async function readStatus(cwd: string, id: string): Promise<RunStatus> {
  const raw = await readFile(path.join(runDir(cwd, id), "status.json"), "utf8");
  return StatusSchema.parse(JSON.parse(raw));
}

export async function listStatuses(cwd: string): Promise<RunStatus[]> {
  try {
    const entries = await readdir(runsRoot(cwd), { withFileTypes: true });
    const statuses = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => readStatus(cwd, entry.name))
    );
    return statuses.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
