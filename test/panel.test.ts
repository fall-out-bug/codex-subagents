import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

describe("subagent panels", () => {
  it("runs multiple built-in role templates and records panel status", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
role="unknown"
if [[ "$*" == *"Role: security-reviewer"* ]]; then role="security-reviewer"; fi
if [[ "$*" == *"Role: code-reviewer"* ]]; then role="code-reviewer"; fi
cat <<JSON
{
  "schemaVersion": "subagent-result/v1",
  "status": "pass",
  "summary": "$role ok",
  "findings": [],
  "evidence": ["$role"],
  "nextActions": []
}
JSON
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

    const output = await execFileAsync(
      "node",
      [
        "--import",
        "tsx",
        "src/cli.ts",
        "panel",
        "run",
        "pi",
        "--cwd",
        cwd,
        "--context-pack",
        contextPath,
        "--role",
        "security-reviewer",
        "--role",
        "code-reviewer"
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH ?? ""}` }
      }
    );

    const panel = JSON.parse(output.stdout);
    expect(panel.schemaVersion).toBe("subagent-panel/v1");
    expect(panel.runs.map((run: { roleId: string }) => run.roleId)).toEqual([
      "security-reviewer",
      "code-reviewer"
    ]);
    expect(panel.runs.every((run: { state: string }) => run.state === "pass")).toBe(true);

    const status = await execFileAsync("node", ["--import", "tsx", "src/cli.ts", "panel", "status", panel.id, "--cwd", cwd], {
      cwd: process.cwd()
    });
    expect(JSON.parse(status.stdout).id).toBe(panel.id);

    const results = await execFileAsync(
      "node",
      ["--import", "tsx", "src/cli.ts", "panel", "results", panel.id, "--structured", "--cwd", cwd],
      { cwd: process.cwd() }
    );
    const parsedResults = JSON.parse(results.stdout);
    expect(parsedResults.runs.map((run: { result: { summary: string } }) => run.result.summary)).toEqual([
      "security-reviewer ok",
      "code-reviewer ok"
    ]);
  });
});

async function tempProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-subagents-panel-"));
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
