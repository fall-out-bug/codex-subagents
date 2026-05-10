import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const ResearchSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().optional(),
  path: z.string().optional(),
  content: z.string(),
  trusted: z.boolean()
});
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

export const ResearchSourcePackSchema = z.object({
  schemaVersion: z.literal("research-sources/v1"),
  query: z.string(),
  createdAt: z.string(),
  sources: z.array(ResearchSourceSchema)
});
export type ResearchSourcePack = z.infer<typeof ResearchSourcePackSchema>;

export type BuildResearchSourcesOptions = {
  cwd: string;
  query: string;
  urls?: string[];
  files?: string[];
  notes?: string[];
};

export async function buildResearchSources(options: BuildResearchSourcesOptions): Promise<ResearchSourcePack> {
  const sources: ResearchSource[] = [];

  for (const url of options.urls ?? []) {
    const response = await fetch(url);
    const content = await response.text();
    sources.push({
      id: `source-${sources.length + 1}`,
      title: titleFromContent(content) ?? url,
      url,
      content,
      trusted: false
    });
  }

  for (const file of options.files ?? []) {
    const content = await readFile(path.resolve(options.cwd, file), "utf8");
    sources.push({
      id: `source-${sources.length + 1}`,
      title: path.basename(file),
      path: file,
      content,
      trusted: false
    });
  }

  for (const note of options.notes ?? []) {
    sources.push({
      id: `source-${sources.length + 1}`,
      title: `note-${sources.length + 1}`,
      content: note,
      trusted: false
    });
  }

  return ResearchSourcePackSchema.parse({
    schemaVersion: "research-sources/v1",
    query: options.query,
    createdAt: new Date().toISOString(),
    sources
  });
}

export async function readResearchSources(filePath: string): Promise<ResearchSourcePack> {
  return ResearchSourcePackSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
}

export async function writeResearchSources(filePath: string, pack: ResearchSourcePack): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(pack, null, 2)}\n`);
}

function titleFromContent(content: string): string | null {
  const match = /<title>([^<]+)<\/title>/i.exec(content);
  return match?.[1]?.trim() ?? null;
}
