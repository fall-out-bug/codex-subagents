import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { readRequest, readStatus } from "../src/registry.js";
import { runSubagent } from "../src/runner.js";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("worktree isolation", () => {
  it("runs a subagent from an isolated git worktree while keeping registry in the source repo", async () => {
    const cwd = await tempGitProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
pwd
`);

    const result = await runSubagent({
      runtime: "pi",
      cwd,
      task: "isolated task",
      timeoutMs: 10_000,
      pathPrefix: fakeBin,
      isolate: "worktree"
    });

    const request = await readRequest(cwd, result.id);
    const status = await readStatus(cwd, result.id);
    const output = await readFile(status.resultPath, "utf8");

    const executionCwd = request.executionCwd;
    expect(request.cwd).toBe(cwd);
    expect(executionCwd).toBeDefined();
    expect(executionCwd).toContain(path.join(cwd, ".codex-subagents", "worktrees"));
    expect(executionCwd).not.toBe(cwd);
    expect(status.state).toBe("pass");
    expect(await realpath(output.trim())).toBe(await realpath(executionCwd!));
  });
});

async function tempGitProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-subagents-isolation-"));
  tempRoots.push(root);
  await execFileAsync("git", ["init", "-b", "main"], { cwd: root });
  await writeFile(path.join(root, "README.md"), "# test\n");
  await execFileAsync("git", ["add", "README.md"], { cwd: root });
  await execFileAsync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"], { cwd: root });
  return root;
}

async function fakeRuntime(cwd: string, name: string, script: string): Promise<string> {
  const bin = path.join(cwd, "bin");
  await import("node:fs/promises").then((fs) => fs.mkdir(bin, { recursive: true }));
  const runtimePath = path.join(bin, name);
  await writeFile(runtimePath, script, { mode: 0o755 });
  return bin;
}
