import { describe, expect, it } from "vitest";
import { adapterFor } from "../src/adapters.js";
import type { RunRequest } from "../src/types.js";

function request(overrides: Partial<RunRequest>): RunRequest {
  return {
    id: "run-1",
    runtime: "pi",
    cwd: "/tmp/project",
    task: "Inspect the repo",
    timeoutMs: 1000,
    createdAt: "2026-05-10T00:00:00.000Z",
    ...overrides
  };
}

describe("runtime adapters", () => {
  it("builds a read-only pi command", () => {
    const command = adapterFor("pi").buildCommand(request({ profile: "readonly" }));

    expect(command.command).toBe("pi");
    expect(command.args).toContain("--no-session");
    expect(command.args).toContain("--tools");
    expect(command.args).toContain("read,grep,find,ls");
  });

  it("builds an opencode command with agent and model", () => {
    const command = adapterFor("opencode").buildCommand(
      request({ runtime: "opencode", agent: "explore", model: "openai/gpt-5.4" })
    );

    expect(command.command).toBe("opencode");
    expect(command.args).toContain("--agent");
    expect(command.args).toContain("explore");
    expect(command.args).toContain("--model");
    expect(command.args).toContain("openai/gpt-5.4");
  });

  it("builds a gsd2 command", () => {
    const command = adapterFor("gsd2").buildCommand(request({ runtime: "gsd2", profile: "plan" }));

    expect(command.command).toBe("gsd");
    expect(command.args).toEqual(["plan", "Inspect the repo"]);
  });
});
