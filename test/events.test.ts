import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readEvents } from "../src/events.js";
import { runSubagent, startSubagent } from "../src/runner.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("run events", () => {
  it("records sync launch and finish events", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
echo "sync-ok"
`);

    const result = await runSubagent({
      runtime: "pi",
      cwd,
      task: "sync event task",
      timeoutMs: 10_000,
      pathPrefix: fakeBin
    });

    const events = await readEvents(cwd, result.id);
    expect(events.map((event) => event.type)).toEqual([
      "run.created",
      "process.started",
      "process.finished"
    ]);
    expect(events[1]?.data?.command).toBe("pi");
  });

  it("records background monitor and process events", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
echo "background-ok"
`);

    const result = await startSubagent({
      runtime: "pi",
      cwd,
      task: "background event task",
      timeoutMs: 10_000,
      pathPrefix: fakeBin
    });

    await wait(1000);
    const events = await readEvents(cwd, result.id);
    expect(events.map((event) => event.type)).toContain("monitor.started");
    expect(events.map((event) => event.type)).toContain("process.started");
    expect(events.map((event) => event.type)).toContain("process.finished");
  });
});

async function tempProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-subagents-events-"));
  tempRoots.push(root);
  return root;
}

async function fakeRuntime(cwd: string, name: string, script: string): Promise<string> {
  const bin = path.join(cwd, "bin");
  await import("node:fs/promises").then((fs) => fs.mkdir(bin, { recursive: true }));
  const runtimePath = path.join(bin, name);
  await writeFile(runtimePath, script, { mode: 0o755 });
  return bin;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
