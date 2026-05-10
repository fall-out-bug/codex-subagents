import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { runAutoresearch } from "../src/autoresearch.js";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("autoresearch experiment loop", () => {
  it("runs bounded candidates, records metrics, and selects the best passing candidate", async () => {
    const cwd = await tempGitProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
if [[ "$*" == *"candidate 1"* ]]; then
  echo "candidate=1" > score.txt
else
  echo "candidate=2" > score.txt
fi
cat <<'JSON'
{
  "schemaVersion": "subagent-result/v1",
  "status": "pass",
  "summary": "candidate changed score",
  "findings": [],
  "evidence": ["score.txt"],
  "nextActions": []
}
JSON
`);
    const metricPath = path.join(cwd, "metric.mjs");
    await writeFile(metricPath, `
import { readFileSync } from "node:fs";
const raw = readFileSync("score.txt", "utf8");
const score = raw.includes("candidate=2") ? 2 : raw.includes("candidate=1") ? 1 : 0;
console.log(JSON.stringify({ score }));
`);
    const programPath = path.join(cwd, "program.md");
    await writeFile(programPath, [
      "# Program",
      "Question: improve the score.",
      "Metric: higher score wins.",
      "Allowed files: score.txt."
    ].join("\n"));

    const result = await runAutoresearch({
      cwd,
      runtime: "pi",
      programPath,
      metricCommand: `node ${metricPath}`,
      candidates: 2,
      timeoutMs: 10_000,
      pathPrefix: fakeBin
    });

    expect(result.schemaVersion).toBe("autoresearch-run/v1");
    expect(result.baseline.score).toBe(0);
    expect(result.experiments).toHaveLength(2);
    expect(result.best?.candidate).toBe(2);
    expect(result.best?.metric.score).toBe(2);

    const events = await readFile(path.join(cwd, ".codex-subagents", "autoresearch", result.id, "experiments.jsonl"), "utf8");
    expect(events.trim().split("\n")).toHaveLength(2);
    const baseline = JSON.parse(await readFile(path.join(cwd, ".codex-subagents", "autoresearch", result.id, "baseline.json"), "utf8"));
    expect(baseline.score).toBe(0);

    const bestPatch = await readFile(path.join(cwd, ".codex-subagents", "autoresearch", result.id, "best.patch"), "utf8");
    expect(bestPatch).toContain("+candidate=2");
    await expect(access(path.join(
      cwd,
      ".codex-subagents",
      "autoresearch",
      result.id,
      "candidates",
      "candidate-2",
      "patch.diff"
    ))).resolves.toBeUndefined();
  });

  it("exposes an autoresearch CLI command", async () => {
    const cwd = await tempGitProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
echo "candidate=1" > score.txt
echo '{"schemaVersion":"subagent-result/v1","status":"pass","summary":"ok","findings":[],"evidence":["score.txt"],"nextActions":[]}'
`);
    const metricPath = path.join(cwd, "metric.mjs");
    await writeFile(metricPath, "console.log(JSON.stringify({ score: 1 }));\n");
    const programPath = path.join(cwd, "program.md");
    await writeFile(programPath, "Question: test autoresearch.\n");

    const output = await execFileAsync(
      "node",
      [
        "--import",
        "tsx",
        "src/cli.ts",
        "autoresearch",
        "run",
        "pi",
        "--cwd",
        cwd,
        "--program",
        programPath,
        "--metric",
        `node ${metricPath}`,
        "--candidates",
        "1"
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH ?? ""}` }
      }
    );

    const parsed = JSON.parse(output.stdout);
    expect(parsed.baseline.score).toBe(1);
    expect(parsed.experiments[0]?.state).toBe("pass");
    expect(parsed.best).toBeNull();
  });
});

async function tempGitProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-subagents-autoresearch-"));
  tempRoots.push(root);
  await execFileAsync("git", ["init", "-b", "main"], { cwd: root });
  await writeFile(path.join(root, "README.md"), "# test\n");
  await writeFile(path.join(root, "score.txt"), "candidate=0\n");
  await execFileAsync("git", ["add", "README.md", "score.txt"], { cwd: root });
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
