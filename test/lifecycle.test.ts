import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cancelRun, startSubagent } from "../src/runner.js";
import { readStatus } from "../src/registry.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("run lifecycle", () => {
  it("starts a background run and records pid metadata", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
sleep 0.2
echo "done"
`);

    const result = await startSubagent({
      runtime: "pi",
      cwd,
      task: "background task",
      timeoutMs: 10_000,
      pathPrefix: fakeBin
    });

    const status = await readStatus(cwd, result.id);
    expect(status.state).toBe("running");
    expect(status.pid).toEqual(expect.any(Number));
    expect(status.background).toBe(true);
  });

  it("cancels a running background run and writes cancelled status", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
sleep 30
`);

    const result = await startSubagent({
      runtime: "pi",
      cwd,
      task: "long task",
      timeoutMs: 60_000,
      pathPrefix: fakeBin
    });

    const status = await cancelRun(cwd, result.id);
    expect(status.state).toBe("cancelled");
    expect(status.finishedAt).not.toBeNull();
  });

  it("reconciles a finished background run from pid metadata", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
echo "finished"
`);

    const result = await startSubagent({
      runtime: "pi",
      cwd,
      task: "quick task",
      timeoutMs: 10_000,
      pathPrefix: fakeBin
    });

    await wait(1000);
    const status = await readStatus(cwd, result.id);
    expect(status.state).toBe("pass");
    expect(await readFile(status.resultPath, "utf8")).toContain("finished");
  });
});

async function tempProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-subagents-"));
  tempRoots.push(root);
  return root;
}

async function fakeRuntime(cwd: string, name: string, script: string): Promise<string> {
  const bin = path.join(cwd, "bin");
  await writeFile(path.join(cwd, ".keep"), "");
  await import("node:fs/promises").then((fs) => fs.mkdir(bin, { recursive: true }));
  const runtimePath = path.join(bin, name);
  await writeFile(runtimePath, script, { mode: 0o755 });
  return bin;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
