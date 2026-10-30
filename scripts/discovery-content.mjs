import { readdir, readFile } from "node:fs/promises";
import { parse } from "yaml";

export async function readSermons(directory) {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".md")).sort();
  const entries = await Promise.all(files.map(async (file) => {
    const raw = await readFile(`${directory}/${file}`, "utf8");
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) throw new Error(`Invalid sermon frontmatter: ${file}`);
    const data = parse(match[1]);
    if (!Number.isSafeInteger(data.archiveId) || !data.title) throw new Error(`Invalid sermon identity: ${file}`);
    return { id: file.slice(0, -3), data, body: match[2].trim() };
  }));
  if (new Set(entries.map((entry) => entry.data.archiveId)).size !== entries.length) throw new Error("Duplicate archive IDs in sermon content.");
  return entries;
}
