import { StructuredResultSchema, type StructuredResult } from "./types.js";

export function parseStructuredResult(text: string): StructuredResult {
  const candidate = extractJsonCandidate(text);
  if (candidate) {
    try {
      return StructuredResultSchema.parse({
        ...JSON.parse(candidate),
        structured: true
      });
    } catch {
      // Fall through to the explicit unstructured result below.
    }
  }

  return StructuredResultSchema.parse({
    schemaVersion: "subagent-result/v1",
    status: "not_assessed",
    summary: summarizeText(text),
    findings: [],
    evidence: [],
    nextActions: ["Ask the agent to return subagent-result/v1 JSON."],
    structured: false,
    rawText: text
  });
}

function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  return fenced?.[1]?.trim() ?? null;
}

function summarizeText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "No structured result was returned.";
  }

  return trimmed.length <= 240 ? trimmed : `${trimmed.slice(0, 237)}...`;
}
