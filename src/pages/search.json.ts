import { getCollection } from "astro:content";
import { sortSermons } from "../lib/archive";
import { assignedTopics, getDiscovery } from "../lib/discovery-data";
import { createSearchDocuments } from "../lib/search";

export async function GET() {
  const sermons = sortSermons(await getCollection("sermons"));
  const discovery = getDiscovery(sermons);
  const entries = sermons.map((entry) => ({ ...entry, data: { ...entry.data, tags: [...entry.data.tags, ...assignedTopics(discovery.get(entry.data.archiveId)).flatMap((topic) => [topic.label, ...topic.aliases])] } }));
  const documents = createSearchDocuments(entries, new Map([...discovery].map(([id, record]) => [id, record.topics.map(({ id }) => id)])));
  return new Response(JSON.stringify(documents), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
