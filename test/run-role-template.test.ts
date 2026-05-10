import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("run with built-in role templates", () => {
  it("renders a context-pack task with a built-in role template", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
printf '%s\\n' "$@" > captured-task.txt
echo "ok"
`);
    const contextPath = path.join(cwd, "context.json");
    await writeFile(contextPath, JSON.stringify({
      schemaVersion: "context-pack/v1",
      subject: "PR review",
      mode: "review",
      goal: "Find blockers",
      nonGoals: [],
      cwd,
      createdAt: "2026-05-10T00:00:00.000Z",
      artifacts: [],
      budget: { maxBytes: 1000, bytesUsed: 0, omitted: [] },
      trust: { untrustedArtifactKinds: ["diff"], writeAllowed: false }
    }));

    await execFileAsync(
      "node",
      [
        "--import",
        "tsx",
        "src/cli.ts",
        "run",
        "pi",
        "--cwd",
        cwd,
        "--context-pack",
        contextPath,
        "--role-template",
        "security-reviewer"
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH ?? ""}` }
      }
    );

    const task = await readFile(path.join(cwd, "captured-task.txt"), "utf8");
    expect(task).toContain("Role: security-reviewer");
    expect(task).toContain("Authority: advisory");
    expect(task).toContain("subagent-result/v1");
  });
});

async function tempProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-subagents-role-template-"));
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
