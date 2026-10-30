import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createClefClient, CLEF_MODEL } from "./clef-client.mjs";
import { readSermons } from "./discovery-content.mjs";
import { TAXONOMY_VERSION } from "../src/lib/topic-taxonomy.ts";
import { applyTopicOverride, buildCandidateLists, contentHash, DISCOVERY_PROMPT_VERSION, readScore, readTopicScores, RELATIONSHIP_QUESTIONS, relationshipScore, selectTopics, topicQuestions } from "../src/lib/discovery-core.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({ options: {
  "credential-file": { type: "string" }, ids: { type: "string" }, output: { type: "string" },
  "classify-only": { type: "boolean", default: false },
  "if-credentials": { type: "boolean", default: false },
  "max-requests": { type: "string", default: "1500" },
  concurrency: { type: "string", default: "3" }, force: { type: "boolean", default: false }
} });

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}
async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, file);
}
async function concurrent(items, concurrency, worker) {
  let next = 0;
  let failure;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length && !failure) {
      const index = next++;
      try { await worker(items[index], index); } catch (error) { failure ??= error; }
    }
  }));
  if (failure) throw failure;
}

async function main() {
  if (values["if-credentials"] && !values["credential-file"] && (!process.env.CLOUDFLARE_WORKERSAI_API_KEY || !process.env.CLOUDFLARE_WORKERSAI_ACCOUNT_ID)) {
    console.log(JSON.stringify({ discovery: "preserved", reason: "Cloudflare credentials are not configured" }));
    return;
  }
  const concurrency = Number(values.concurrency);
  const maxRequests = Number(values["max-requests"]);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5 || !Number.isInteger(maxRequests) || maxRequests < 1) throw new Error("Invalid request limit or concurrency.");
  const allEntries = await readSermons(path.join(root, "src/content/sermons"));
  const ids = values.ids?.split(",").map(Number);
  if (ids?.some((id) => !Number.isSafeInteger(id) || !allEntries.some((entry) => entry.data.archiveId === id))) throw new Error("Unknown sample archive ID.");
  const entries = ids ? allEntries.filter((entry) => ids.includes(entry.data.archiveId)) : allEntries;
  const overrides = await readJson(path.join(root, "src/data/topic-overrides.json"), {});
  for (const entry of entries) applyTopicOverride([], overrides[String(entry.data.archiveId)]);
  const output = path.resolve(root, values.output ?? (ids || values["classify-only"] ? ".cache/clef-sample.json" : "src/data/discovery.json"));
  if ((ids || values["classify-only"]) && output === path.join(root, "src/data/discovery.json")) throw new Error("A sample cannot replace the published discovery artifact.");
  const cachePath = path.join(root, ".cache/clef-responses.json");
  const cache = await readJson(cachePath, { responses: {} });
  const run = await createClefClient(values["credential-file"]);
  let requests = 0;
  let reused = 0;
  let inputTokens = 0;
  let saveQueue = Promise.resolve();

  async function decide(state, questions) {
    const key = createHash("sha256").update(JSON.stringify({ model: CLEF_MODEL, prompt: DISCOVERY_PROMPT_VERSION, state, questions })).digest("hex");
    const legacyKey = cache.legacyTaxonomy && createHash("sha256").update(JSON.stringify({ model: CLEF_MODEL, taxonomy: cache.legacyTaxonomy, prompt: DISCOVERY_PROMPT_VERSION, state, questions })).digest("hex");
    const cached = cache.responses[key] ?? (legacyKey && cache.responses[legacyKey]);
    if (!values.force && cached) {
      reused++;
      cache.responses[key] = cached;
      return cached;
    }
    if (++requests > maxRequests) throw new Error("Clef request limit reached. Cached progress is preserved; rerun to resume.");
    const result = await run(state, questions);
    for (const id of Object.keys(questions)) readScore(result.answers[id]);
    inputTokens += result.usage?.input_tokens ?? 0;
    cache.responses[key] = { ...result, evaluatedAt: new Date().toISOString() };
    saveQueue = saveQueue.then(() => atomicJson(cachePath, cache));
    await saveQueue;
    return result;
  }

  const assignments = new Map();
  const questions = topicQuestions();
  await concurrent(entries, concurrency, async (entry) => {
    const result = await decide({ title: entry.data.title, transcript: entry.body }, questions);
    const topics = applyTopicOverride(selectTopics(readTopicScores(result.answers)), overrides[String(entry.data.archiveId)]);
    assignments.set(entry.data.archiveId, topics);
    console.log(JSON.stringify({ phase: "topics", archiveId: entry.data.archiveId, topics: topics.map((topic) => topic.id) }));
  });

  const candidates = buildCandidateLists(entries, assignments);
  const pairs = new Map();
  for (const source of entries) for (const { entry: target } of candidates.get(source.data.archiveId) ?? []) {
    const pair = [source, target].sort((a, b) => a.data.archiveId - b.data.archiveId);
    pairs.set(pair.map((entry) => entry.data.archiveId).join(":"), pair);
  }
  const pairScores = new Map();
  if (!values["classify-only"]) await concurrent([...pairs], concurrency, async ([key, pair], index) => {
    const result = await decide({ sermon_a: { title: pair[0].data.title, transcript: pair[0].body }, sermon_b: { title: pair[1].data.title, transcript: pair[1].body } }, RELATIONSHIP_QUESTIONS);
    pairScores.set(key, relationshipScore(result.answers));
    if ((index + 1) % 20 === 0) console.log(JSON.stringify({ phase: "relationships", completed: pairScores.size, total: pairs.size }));
  });

  const artifact = {
    schemaVersion: 1, taxonomyVersion: TAXONOMY_VERSION, promptVersion: DISCOVERY_PROMPT_VERSION,
    model: CLEF_MODEL, generatedAt: new Date().toISOString(), sermons: {}
  };
  for (const entry of entries) {
    const related = (candidates.get(entry.data.archiveId) ?? []).flatMap((candidate) => {
      const key = [entry.data.archiveId, candidate.entry.data.archiveId].sort((a, b) => a - b).join(":");
      const score = pairScores.get(key);
      return score == null ? [] : [{ archiveId: candidate.entry.data.archiveId, contentHash: contentHash(candidate.entry), score, sharedTopics: candidate.sharedTopics }];
    }).sort((a, b) => b.score - a.score || a.archiveId - b.archiveId).slice(0, 4);
    artifact.sermons[String(entry.data.archiveId)] = { contentHash: contentHash(entry), topics: assignments.get(entry.data.archiveId), topicSource: Object.hasOwn(overrides, String(entry.data.archiveId)) ? "curator" : "clef", related };
  }
  const previous = await readJson(output, null);
  if (previous && JSON.stringify({ ...previous, generatedAt: null }) === JSON.stringify({ ...artifact, generatedAt: null })) artifact.generatedAt = previous.generatedAt;
  await atomicJson(output, artifact);
  console.log(JSON.stringify({ output: path.relative(root, output), sermons: entries.length, requests, reused, inputTokens, estimatedInputCostUsd: Number((inputTokens / 1_000_000 * 0.24).toFixed(4)) }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
