import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const skillsRoot = path.join(process.cwd(), "skills");

describe("packaged skills", () => {
  it("ships skill entrypoints with frontmatter and codex-subagent usage", async () => {
    const entries = await readdir(skillsRoot, { withFileTypes: true });
    const skillDirs = (await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => hasSkillFile(entry.name))
    )).filter((name): name is string => Boolean(name)).sort();

    expect(skillDirs).toEqual([
      "subagent-council",
      "subagent-dev",
      "subagent-research",
      "subagent-review"
    ]);

    for (const skill of skillDirs) {
      const body = await readFile(path.join(skillsRoot, skill, "SKILL.md"), "utf8");
      expect(body).toMatch(/^---\nname: .+\ndescription: .+\n/m);
      expect(body).toContain("codex-subagent");
      expect(body).toContain("context-pack/v1");
      expect(body).toContain("role-card/v1");
      expect(body).not.toContain("--role-card roles/");
    }
  });

  it("documents current role-template, panel, and structured-result flows", async () => {
    const review = await readFile(path.join(skillsRoot, "subagent-review", "SKILL.md"), "utf8");
    const council = await readFile(path.join(skillsRoot, "subagent-council", "SKILL.md"), "utf8");
    const dev = await readFile(path.join(skillsRoot, "subagent-dev", "SKILL.md"), "utf8");
    const research = await readFile(path.join(skillsRoot, "subagent-research", "SKILL.md"), "utf8");

    expect(review).toContain("codex-subagent panel run");
    expect(review).toContain("codex-subagent panel results <panel-id> --structured");
    expect(council).toContain("codex-subagent panel run");
    expect(dev).toContain("--role-template worker");
    expect(research).toContain("codex-subagent autoresearch run");
    expect(research).toContain("--role-template researcher");
    expect(`${review}\n${council}\n${dev}\n${research}`).toContain("subagent-result/v1");
  });
});

async function hasSkillFile(name: string): Promise<string | null> {
  try {
    await access(path.join(skillsRoot, name, "SKILL.md"));
    return name;
  } catch {
    return null;
  }
}
