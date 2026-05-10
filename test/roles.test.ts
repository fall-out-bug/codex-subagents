import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { getRoleTemplate, listRoleTemplates } from "../src/roles.js";
import { RoleCardSchema } from "../src/types.js";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("built-in role templates", () => {
  it("ships reusable roles for review, council, dev, and research workflows", () => {
    const ids = listRoleTemplates().map((role) => role.id);

    expect(ids).toContain("requirements-reviewer");
    expect(ids).toContain("security-reviewer");
    expect(ids).toContain("architect");
    expect(ids).toContain("worker");
    expect(ids).toContain("experimenter");

    for (const role of listRoleTemplates()) {
      expect(RoleCardSchema.parse(role)).toEqual(role);
    }
  });

  it("keeps security review advisory and unable to approve merges", () => {
    const role = getRoleTemplate("security-reviewer");

    expect(role.authority).toBe("advisory");
    expect(role.canVeto).toContain("secret exposure");
    expect(role.mustNot).toContain("approve merge");
    expect(role.modelPolicy.familyDiversity).toBe("required");
  });

  it("prints and writes templates from the CLI", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "codex-subagents-roles-"));
    tempRoots.push(root);
    const out = path.join(root, "security-reviewer.json");

    const list = await execFileAsync("node", ["--import", "tsx", "src/cli.ts", "role", "list"], {
      cwd: process.cwd()
    });
    expect(JSON.parse(list.stdout).map((role: { id: string }) => role.id)).toContain("security-reviewer");

    const show = await execFileAsync("node", ["--import", "tsx", "src/cli.ts", "role", "show", "security-reviewer"], {
      cwd: process.cwd()
    });
    expect(JSON.parse(show.stdout).id).toBe("security-reviewer");

    await execFileAsync(
      "node",
      ["--import", "tsx", "src/cli.ts", "role", "write", "security-reviewer", "--out", out],
      { cwd: process.cwd() }
    );
    const written = RoleCardSchema.parse(JSON.parse(await readFile(out, "utf8")));
    expect(written.id).toBe("security-reviewer");
  });
});
