import path from "node:path";

export function registryRoot(cwd: string): string {
  return path.join(cwd, ".codex-subagents");
}

export function runsRoot(cwd: string): string {
  return path.join(registryRoot(cwd), "runs");
}

export function runDir(cwd: string, id: string): string {
  return path.join(runsRoot(cwd), id);
}

export function runResultPath(cwd: string, id: string): string {
  return path.join(runDir(cwd, id), "result.md");
}

export function panelsRoot(cwd: string): string {
  return path.join(registryRoot(cwd), "panels");
}

export function autoresearchRoot(cwd: string): string {
  return path.join(registryRoot(cwd), "autoresearch");
}

export function autoresearchRunDir(cwd: string, id: string): string {
  return path.join(autoresearchRoot(cwd), id);
}
