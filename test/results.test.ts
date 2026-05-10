import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { parseStructuredResult } from "../src/results.js";
import { runSubagent } from "../src/runner.js";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("structured subagent results", () => {
  it("parses a fenced subagent-result/v1 JSON block", () => {
    const parsed = parseStructuredResult(`
Review notes.

\`\`\`json
{
  "schemaVersion": "subagent-result/v1",
  "status": "partial",
  "summary": "Found one major issue.",
  "findings": [
    {
      "severity": "major",
      "title": "Missing validation",
      "body": "Input reaches the adapter unchecked.",
      "evidence": ["src/adapters.ts"],
      "recommendation": "Validate before launch."
    }
  ],
  "evidence": ["unit test failed"],
  "nextActions": ["Add validation"]
}
\`\`\`
`);

    expect(parsed.status).toBe("partial");
    expect(parsed.findings[0]?.severity).toBe("major");
    expect(parsed.structured).toBe(true);
  });

  it("falls back to not_assessed for free-form text", () => {
    const parsed = parseStructuredResult("Looks okay, but no JSON contract.");

    expect(parsed.status).toBe("not_assessed");
    expect(parsed.structured).toBe(false);
    expect(parsed.rawText).toContain("Looks okay");
  });

  it("prints structured results from a completed run", async () => {
    const cwd = await tempProject();
    const fakeBin = await fakeRuntime(cwd, "pi", `#!/usr/bin/env bash
cat <<'JSON'
{
  "schemaVersion": "subagent-result/v1",
  "status": "pass",
  "summary": "No blockers.",
  "findings": [],
  "evidence": ["fake runtime"],
  "nextActions": []
}
JSON
`);

    const result = await runSubagent({
      runtime: "pi",
      cwd,
      task: "structured result task",
      timeoutMs: 10_000,
      pathPrefix: fakeBin
    });

    const output = await execFileAsync("node", ["--import", "tsx", "src/cli.ts", "result", result.id, "--structured", "--cwd", cwd], {
      cwd: process.cwd()
    });
    expect(JSON.parse(output.stdout).status).toBe("pass");
  });
});

async function tempProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-subagents-results-"));
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
