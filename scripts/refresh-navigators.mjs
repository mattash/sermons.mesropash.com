import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSermons } from "./discovery-content.mjs";
import { createNavigatorClient } from "./navigator-client.mjs";
import { CLEF_MODEL } from "./clef-client.mjs";
import { prepareSermon, PASSAGE_VERSION } from "../src/lib/sermon-passages.ts";
import { NAVIGATOR_MODEL, NAVIGATOR_VERSION, navigatorHash, validatePoints, navigatorCandidates, navigatorQuestions, failedNavigatorPoints } from "../src/lib/sermon-navigator.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({ options: {
  "credential-file": { type: "string" }, ids: { type: "string" }, output: { type: "string" },
  "if-credentials": { type: "boolean", default: false }, "max-requests": { type: "string", default: "600" },
  concurrency: { type: "string", default: "3" }, force: { type: "boolean", default: false }
} });
const readJson = async (file, fallback) => { try { return JSON.parse(await readFile(file, "utf8")); } catch (e) { if (e.code === "ENOENT") return fallback; throw e; } };
async function atomic(file, data) { await mkdir(path.dirname(file), { recursive: true }); const temp = file + "." + process.pid + ".tmp"; await writeFile(temp, JSON.stringify(data, null, 2) + "\n"); await rename(temp, file); }

async function main() {
  if (values["if-credentials"] && !values["credential-file"] && (!process.env.CLOUDFLARE_WORKERSAI_API_KEY || !process.env.CLOUDFLARE_WORKERSAI_ACCOUNT_ID)) { console.log('{"navigators":"preserved","reason":"credentials unavailable"}'); return; }
  const concurrency = Number(values.concurrency), max = Number(values["max-requests"]);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5 || !Number.isInteger(max) || max < 1) throw new Error("Invalid navigator request limit or concurrency.");
  const all = await readSermons(path.join(root, "src/content/sermons")), ids = values.ids?.split(",").map(Number);
  if (ids?.some((id) => !Number.isSafeInteger(id) || !all.some((entry) => entry.data.archiveId === id))) throw new Error("Unknown navigator sample ID.");
  const entries = ids ? all.filter((e) => ids.includes(e.data.archiveId)) : all;
  const output = path.resolve(root, values.output ?? (ids ? ".cache/navigator-sample.json" : "src/data/navigators.json"));
  if (ids && output === path.join(root, "src/data/navigators.json")) throw new Error("Sample cannot replace published navigators.");
  const cacheFile = path.join(root, ".cache/navigator-responses.json"), progressFile = path.join(root, ".cache/navigator-progress.json");
  const cache = await readJson(cacheFile, { responses: {} }), progress = await readJson(progressFile, { records: {} });
  const previous = await readJson(output, null);
  const client = await createNavigatorClient(values["credential-file"]);
  let requests = 0, reused = 0, next = 0, failure, saveQueue = Promise.resolve();
  const records = {};
  async function checkpoint() { saveQueue = saveQueue.then(async () => { await atomic(cacheFile, cache); await atomic(progressFile, progress); }); await saveQueue; }
  async function request(kind, state, questions) {
    const key = createHash("sha256").update(JSON.stringify({ version: NAVIGATOR_VERSION, model: kind === "generate" ? NAVIGATOR_MODEL : CLEF_MODEL, state, questions })).digest("hex");
    if (!values.force && cache.responses[key]) { reused++; return cache.responses[key]; }
    if (++requests > max) throw new Error("Navigator request budget reached; progress is saved.");
    const result = kind === "generate" ? await client.generate(state) : await client.judge(state, questions);
    cache.responses[key] = result; await checkpoint(); return result;
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (next < entries.length && !failure) {
      const entry = entries[next++];
      try {
        const { passages } = await prepareSermon(entry.body), hash = navigatorHash(entry), key = entry.data.archiveId + ":" + hash;
        const saved = progress.records[key] ?? (previous?.promptVersion === NAVIGATOR_VERSION && previous?.generationModel === NAVIGATOR_MODEL ? previous.sermons[String(entry.data.archiveId)] : undefined);
        if (!values.force && saved?.contentHash === hash) {
          try {
            records[String(entry.data.archiveId)] = { contentHash: hash, points: validatePoints(saved.points, passages) };
            reused++; console.log(JSON.stringify({ archiveId: entry.data.archiveId, points: saved.points.length, reused: true })); continue;
          } catch { /* Regenerate anchors changed by rendering. */ }
        }
        let repair, record;
        for (let attempt = 0; attempt < 3 && !record; attempt++) {
          const state = { title: entry.data.title, language: entry.data.language, passages, ...(repair ? { repair } : {}) };
          const draft = await request("generate", state);
          let points;
          try { points = navigatorCandidates(draft.points, passages); } catch (error) { repair = { previous: draft.points, error: error.message }; continue; }
          const checked = await request("judge", { title: entry.data.title, passages, points }, navigatorQuestions(points));
          const failed = failedNavigatorPoints(points, checked.answers);
          const accepted = points.filter((_, index) => !failed.includes(index));
          if (accepted.length < 3) {
            repair = { previous: points, rejectedPoints: failed.map((index) => points[index]), error: "Replace or omit the rejected points. Each needs direct support from its exact cited passage and must express an important teaching. Return at least three supported, distinct points." };
            continue;
          }
          // Keep only points that passed both checks; never pad an outline with a failed claim.
          record = { contentHash: hash, points: accepted };
        }
        if (!record) throw new Error("Navigator could not be verified for sermon " + entry.data.archiveId + "; published data is unchanged.");
        records[String(entry.data.archiveId)] = record; progress.records[key] = record; await checkpoint();
        console.log(JSON.stringify({ archiveId: entry.data.archiveId, points: record.points.length, verified: true }));
      } catch (error) { failure ??= error; }
    }
  }));
  if (failure) throw failure;
  const artifact = { schemaVersion: 1, promptVersion: NAVIGATOR_VERSION, passageVersion: PASSAGE_VERSION, generationModel: NAVIGATOR_MODEL, verificationModel: CLEF_MODEL, generatedAt: new Date().toISOString(), sermons: records };
  if (previous && JSON.stringify({ ...previous, generatedAt: "" }) === JSON.stringify({ ...artifact, generatedAt: "" })) artifact.generatedAt = previous.generatedAt;
  await atomic(output, artifact);
  console.log(JSON.stringify({ output: path.relative(root, output), sermons: entries.length, requests, reused }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
