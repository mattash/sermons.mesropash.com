import type { CollectionEntry } from "astro:content";
import artifact from "../data/discovery.json";
import { currentDiscovery, type DiscoveryArtifact, type DiscoveryRecord } from "./discovery-core";
import { sortSermons } from "./archive";
import { TOPICS } from "./topic-taxonomy";
import { tagSlug } from "./tags";

export function getDiscovery(entries: CollectionEntry<"sermons">[]) {
  return currentDiscovery(entries, artifact as DiscoveryArtifact);
}

export function assignedTopics(record: DiscoveryRecord | undefined | null) {
  return (record?.topics ?? []).flatMap(({ id }) => {
    const topic = TOPICS.find((topic) => topic.id === id);
    return topic ? [topic] : [];
  });
}

export function topicRoutes(entries: CollectionEntry<"sermons">[]) {
  const discovery = getDiscovery(entries);
  const sorted = sortSermons(entries);
  const canonical = TOPICS.map((topic) => ({
    slug: topic.id as string,
    title: topic.label as string,
    description: topic.description as string,
    canonical: true,
    sermons: sorted.filter((entry) => discovery.get(entry.data.archiveId)?.topics.some(({ id }) => id === topic.id))
  })).filter((topic) => topic.sermons.length > 0);
  const legacy = [...new Set(entries.flatMap((entry) => entry.data.tags))].map((tag) => ({
    slug: tagSlug(tag), title: tag, description: `Sermons with the keyword “${tag}”.`, canonical: false,
    sermons: sorted.filter((entry) => entry.data.tags.includes(tag))
  }));
  return [...canonical, ...legacy];
}
