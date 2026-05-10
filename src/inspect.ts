import { readFile } from "node:fs/promises";
import path from "node:path";
import { eventsPath, readEvents } from "./events.js";
import { runDir } from "./paths.js";
import { readRequest, readStatus } from "./registry.js";
import type { RunEvent, RunRequest, RunStatus } from "./types.js";

export type LogName = "stdout" | "stderr";

export type RunInspection = {
  request: RunRequest;
  status: RunStatus;
  events: RunEvent[];
  paths: {
    runDir: string;
    request: string;
    status: string;
    events: string;
    stdout: string;
    stderr: string;
    result: string;
  };
};

export async function inspectRun(cwd: string, id: string): Promise<RunInspection> {
  const dir = runDir(cwd, id);
  const [request, status, events] = await Promise.all([
    readRequest(cwd, id),
    readStatus(cwd, id),
    readEvents(cwd, id)
  ]);

  return {
    request,
    status,
    events,
    paths: {
      runDir: dir,
      request: path.join(dir, "request.json"),
      status: path.join(dir, "status.json"),
      events: eventsPath(cwd, id),
      stdout: path.join(dir, "stdout.log"),
      stderr: path.join(dir, "stderr.log"),
      result: status.resultPath
    }
  };
}

export async function readRunLog(cwd: string, id: string, logName: LogName): Promise<string> {
  const fileName = logName === "stdout" ? "stdout.log" : "stderr.log";
  return readFile(path.join(runDir(cwd, id), fileName), "utf8");
}
