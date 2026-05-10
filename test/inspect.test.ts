import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectRun, readRunLog } from "../src/inspect.js";
import { runSubagent } from "../src/runner.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("operator inspection", () => {
  it("returns request, status, events, and paths for a run", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
echo "inspect-ok"
`);

    const result = await runSubagent({
      runtime: "pi",
      cwd,
      task: "inspect task",
      timeoutMs: 10_000,
      pathPrefix: fakeBin
    });

    const inspected = await inspectRun(cwd, result.id);
    expect(inspected.request.task).toBe("inspect task");
    expect(inspected.status.state).toBe("pass");
    expect(inspected.events.length).toBeGreaterThan(0);
    expect(inspected.paths.stdout).toContain("stdout.log");
  });

  it("reads stdout and stderr logs by name", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
echo "stdout-line"
echo "stderr-line" >&2
`);

    const result = await runSubagent({
      runtime: "pi",
      cwd,
      task: "logs task",
      timeoutMs: 10_000,
      pathPrefix: fakeBin
    });

    await expect(readRunLog(cwd, result.id, "stdout")).resolves.toContain("stdout-line");
    await expect(readRunLog(cwd, result.id, "stderr")).resolves.toContain("stderr-line");
  });
});

async function tempProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-subagents-inspect-"));
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
