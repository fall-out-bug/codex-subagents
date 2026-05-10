import type { LaunchCommand, RunRequest, RuntimeAdapter, RuntimeName } from "./types.js";

function piToolsForProfile(profile?: string): string[] | undefined {
  if (profile === "readonly" || profile === "review" || profile === "explore") {
    return ["read", "grep", "find", "ls"];
  }

  return undefined;
}

export const piAdapter: RuntimeAdapter = {
  name: "pi",
  buildCommand(request: RunRequest): LaunchCommand {
    const args = ["-p", "--no-context-files"];

    if (request.model) {
      args.push("--model", request.model);
    }

    const tools = piToolsForProfile(request.profile);
    if (tools) {
      args.push("--tools", tools.join(","));
    }

    args.push(request.task);
    return { command: "pi", args };
  }
};

export const opencodeAdapter: RuntimeAdapter = {
  name: "opencode",
  buildCommand(request: RunRequest): LaunchCommand {
    const args = ["run", "--format", "json", "--dir", request.cwd];

    if (request.agent) {
      args.push("--agent", request.agent);
    }

    if (request.model) {
      args.push("--model", request.model);
    }

    args.push(request.task);
    return { command: "opencode", args };
  }
};

export const gsd2Adapter: RuntimeAdapter = {
  name: "gsd2",
  buildCommand(request: RunRequest): LaunchCommand {
    const args: string[] = [];

    if (request.profile) {
      args.push(request.profile);
    }

    args.push(request.task);
    return { command: "gsd", args };
  }
};

const adapters: Record<RuntimeName, RuntimeAdapter> = {
  pi: piAdapter,
  opencode: opencodeAdapter,
  gsd2: gsd2Adapter
};

export function adapterFor(runtime: RuntimeName): RuntimeAdapter {
  return adapters[runtime];
}
