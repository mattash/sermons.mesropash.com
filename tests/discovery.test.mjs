import test from "node:test";
import assert from "node:assert/strict";
import { TOPICS } from "../src/lib/topic-taxonomy.ts";
import { applyTopicOverride, buildCandidateLists, contentHash, currentDiscovery, DISCOVERY_MODEL, readScore, readTopicScores, relationshipScore, selectTopics } from "../src/lib/discovery-core.ts";

const entry = (id, text = "A reflection on repentance and forgiveness.", video = `video-${id}`) => ({ id: `sermon-${id}`, body: text, data: { archiveId: id, title: `Sermon ${id}`, theme: null, sourceVideoId: video } });
const score = (p = [0, 0, 0, 1]) => ({ score: p.reduce((a, b, i) => a + b * i, 0), confidence: 0.2, probabilities: Object.fromEntries(p.map((v, i) => [i, v])) });
const scores = () => Object.fromEntries(TOPICS.map(({ id }) => [id, readScore(score([1, 0, 0, 0]))]));

test("topic selection supports several themes, ignores passing mentions, and does not force a match", () => {
  const values = scores();
  assert.deepEqual(selectTopics(values), []);
  values.forgiveness = readScore(score([0, 0, 0.3, 0.7]));
  values.repentance = readScore(score([0, 0.05, 0.45, 0.5]));
  values.prayer = readScore(score([0, 0.8, 0.2, 0]));
  assert.deepEqual(selectTopics(values).map(t => t.id), ["forgiveness", "repentance"]);
});

test("invalid, missing, or inconsistent provider scores fail closed", () => {
  assert.throws(() => readScore({ score: NaN, confidence: 1 }));
  assert.throws(() => readScore({ ...score(), score: 2 }));
  assert.throws(() => readTopicScores({}));
});

test("curator corrections replace model suggestions and reject unknown or duplicate topics", () => {
  const suggested = [{ id: "prayer", score: 2.4 }];
  assert.deepEqual(applyTopicOverride(suggested, ["forgiveness"]), [{ id: "forgiveness", score: 3 }]);
  assert.deepEqual(applyTopicOverride(suggested, []), []);
  assert.throws(() => applyTopicOverride(suggested, ["invented-topic"]));
  assert.throws(() => applyTopicOverride(suggested, ["prayer", "prayer"]));
});

test("ordinary keyword overlap cannot pass the Clef relationship gate", () => {
  assert.equal(relationshipScore({ teaching: score([0, 1, 0, 0]), pastoral: score() }), null);
  assert.equal(relationshipScore({ teaching: score([0, 0.2, 0.5, 0.3]), pastoral: score([1, 0, 0, 0]) }), null);
  assert.equal(relationshipScore({ teaching: score(), pastoral: score() }), 3);
});

test("candidate generation excludes self, duplicate source videos, and unrelated topics", () => {
  const entries = [entry(1), entry(2), entry(3, undefined, "video-1"), entry(4)];
  const assignments = new Map([[1, [{ id: "forgiveness", score: 3 }]], [2, [{ id: "forgiveness", score: 3 }]], [3, [{ id: "forgiveness", score: 3 }]], [4, [{ id: "prayer", score: 3 }]]]);
  assert.deepEqual(buildCandidateLists(entries, assignments).get(1).map(c => c.entry.data.archiveId), [2]);
});

test("discovery fingerprints track title, summary and transcript, preserving stable archive identity", () => {
  const original = entry(1);
  assert.notEqual(contentHash(original), contentHash({ ...original, body: "Revised transcript" }));
  assert.equal(contentHash(original), contentHash({ ...original, id: "renamed-url" }));
});

test("changed and withdrawn sermons cannot leave stale topics or recommendation links", () => {
  const source = entry(1), target = entry(2);
  const artifact = { schemaVersion: 1, taxonomyVersion: "1", promptVersion: "1", model: DISCOVERY_MODEL, generatedAt: "2026-10-30", sermons: {
    1: { contentHash: contentHash(source), topics: [{ id: "forgiveness", score: 3 }], related: [{ archiveId: 2, contentHash: contentHash(target), score: 3, sharedTopics: ["forgiveness"] }] },
    2: { contentHash: contentHash(target), topics: [{ id: "forgiveness", score: 3 }], related: [] }
  }};
  assert.equal(currentDiscovery([source, target], artifact).get(1).related.length, 1);
  assert.equal(currentDiscovery([source, { ...target, data: { ...target.data, sourceVideoId: source.data.sourceVideoId } }], artifact).get(1).related.length, 0);
  assert.equal(currentDiscovery([source], artifact).get(1).related.length, 0);
  const changed = { ...target, body: "New text" };
  const result = currentDiscovery([source, changed], artifact);
  assert.equal(result.has(2), false);
  assert.equal(result.get(1).related.length, 0);
});
