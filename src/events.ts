import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runDir } from "./paths.js";
import { RunEventSchema, type RunEvent } from "./types.js";

export function eventsPath(cwd: string, id: string): string {
  return path.join(runDir(cwd, id), "events.jsonl");
}

export async function appendEvent(
  cwd: string,
  id: string,
  event: Omit<RunEvent, "timestamp" | "runId">
): Promise<void> {
  const filePath = eventsPath(cwd, id);
  await mkdir(path.dirname(filePath), { recursive: true });
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    runId: id,
    ...event
  } satisfies RunEvent);
  await writeFile(filePath, `${line}\n`, { flag: "a" });
}

export async function readEvents(cwd: string, id: string): Promise<RunEvent[]> {
  try {
    const raw = await readFile(eventsPath(cwd, id), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => RunEventSchema.parse(JSON.parse(line)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}
