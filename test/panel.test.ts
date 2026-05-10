import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { runPanel } from "../src/panel.js";

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
    expect(panel.id).toMatch(/^panel_/);
    expect(panel.runs.map((run: { roleId: string }) => run.roleId)).toEqual([
      "security-reviewer",
      "code-reviewer"
    ]);
    expect(panel.runs.every((run: { runId: string }) => run.runId.startsWith("run_"))).toBe(true);
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
    expect(parsedResults.summary.status).toBe("pass");
    expect(parsedResults.summary.structured).toEqual({ total: 2, parsed: 2, unstructured: 0 });
    expect(parsedResults.summary.severityCounts).toEqual({ critical: 0, major: 0, minor: 0 });
    expect(parsedResults.summary.evidenceGaps).toEqual([]);
    expect(parsedResults.runs.map((run: { result: { summary: string } }) => run.result.summary)).toEqual([
      "security-reviewer ok",
      "code-reviewer ok"
    ]);
  });

  it("summarizes panel result gaps and finding severities", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
if [[ "$*" == *"Role: security-reviewer"* ]]; then
  cat <<JSON
{
  "schemaVersion": "subagent-result/v1",
  "status": "partial",
  "summary": "security issue",
  "findings": [
    {
      "severity": "critical",
      "title": "Unsafe command",
      "body": "Command input is trusted.",
      "evidence": ["src/runner.ts"]
    }
  ],
  "evidence": ["src/runner.ts"],
  "nextActions": ["Fix command boundary"]
}
JSON
else
  echo "free-form answer"
fi
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
    const results = await execFileAsync(
      "node",
      ["--import", "tsx", "src/cli.ts", "panel", "results", panel.id, "--structured", "--cwd", cwd],
      { cwd: process.cwd() }
    );
    const parsedResults = JSON.parse(results.stdout);

    expect(parsedResults.summary.status).toBe("partial");
    expect(parsedResults.summary.structured).toEqual({ total: 2, parsed: 1, unstructured: 1 });
    expect(parsedResults.summary.severityCounts).toEqual({ critical: 1, major: 0, minor: 0 });
    expect(parsedResults.summary.evidenceGaps).toContain("code-reviewer");
  });

  it("runs synchronous panel roles concurrently", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
sleep 0.6
echo "done"
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

    const startedAt = Date.now();
    await runPanel({
      runtime: "pi",
      cwd,
      contextPackPath: contextPath,
      roleIds: ["security-reviewer", "code-reviewer"],
      timeoutMs: 10_000,
      pathPrefix: fakeBin
    });

    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  it("refreshes child run states when reading panel status", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
sleep 0.1
echo "done"
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
        "--background"
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH ?? ""}` }
      }
    );

    const panel = JSON.parse(output.stdout);
    const refreshed = await waitForPanelState(cwd, panel.id, "pass");
    expect(refreshed.runs[0]?.state).toBe("pass");

    const stored = JSON.parse(await readFile(path.join(cwd, ".codex-subagents", "panels", `${panel.id}.json`), "utf8"));
    expect(stored.runs[0]?.state).toBe("pass");
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

async function waitForPanelState(cwd: string, id: string, state: string) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const output = await execFileAsync("node", ["--import", "tsx", "src/cli.ts", "panel", "status", id, "--cwd", cwd], {
      cwd: process.cwd()
    });
    const panel = JSON.parse(output.stdout);
    if (panel.runs.some((run: { state: string }) => run.state === state)) {
      return panel;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const output = await execFileAsync("node", ["--import", "tsx", "src/cli.ts", "panel", "status", id, "--cwd", cwd], {
    cwd: process.cwd()
  });
  return JSON.parse(output.stdout);
}
