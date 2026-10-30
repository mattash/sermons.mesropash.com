import { readFile } from "node:fs/promises";
import { readSermons } from "../scripts/discovery-content.mjs";
import { currentDiscovery, type DiscoveryArtifact } from "../src/lib/discovery-core.ts";
import { createSearchDocuments } from "../src/lib/search.ts";
import { createSearchHandler } from "../src/lib/search-handler.ts";
import { clefSearchClient } from "../src/lib/semantic-search.ts";

const documents = async () => {
  const entries = await readSermons(`${process.cwd()}/src/content/sermons`);
  const artifact = JSON.parse(await readFile(`${process.cwd()}/src/data/discovery.json`, "utf8")) as DiscoveryArtifact;
  const discovery = currentDiscovery(entries, artifact);
  return createSearchDocuments(entries, new Map([...discovery].map(([id, record]) => [id, record.topics.map(({ id }) => id)])));
};
let corpus: ReturnType<typeof documents> | undefined;
export const POST = createSearchHandler({
  documents: () => corpus ??= documents().catch((error) => { corpus = undefined; throw error; }),
  client: (signal) => clefSearchClient(process.env, signal)
});
