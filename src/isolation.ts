import { mkdir } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { registryRoot } from "./paths.js";

export type IsolationMode = "none" | "worktree";

export async function prepareExecutionCwd(options: {
  cwd: string;
  id: string;
  isolate?: IsolationMode;
}): Promise<string | undefined> {
  if (!options.isolate || options.isolate === "none") {
    return undefined;
  }

  if (options.isolate !== "worktree") {
    throw new Error(`Unsupported isolation mode: ${options.isolate}`);
  }

  const worktreesRoot = path.join(registryRoot(options.cwd), "worktrees");
  const worktreePath = path.join(worktreesRoot, options.id);
  await mkdir(worktreesRoot, { recursive: true });
  await execa("git", ["worktree", "add", "-b", `codex-subagent/${options.id}`, worktreePath, "HEAD"], {
    cwd: options.cwd
  });
  return worktreePath;
}
