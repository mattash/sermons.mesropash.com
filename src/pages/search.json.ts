import { getCollection } from "astro:content";
import { sortSermons } from "../lib/archive";
import { assignedTopics, getDiscovery } from "../lib/discovery-data";

export async function GET() {
  const sermons = sortSermons(await getCollection("sermons"));
  const discovery = getDiscovery(sermons);
  return new Response(JSON.stringify(sermons.map(({ id, data }) => ({ id, data: {
    ...data, tags: [...data.tags, ...assignedTopics(discovery.get(data.archiveId)).flatMap((topic) => [topic.label, ...topic.aliases])]
  } }))), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
