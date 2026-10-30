import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseScripture, passagesOverlap } from '../src/lib/scripture.ts';
import { createSearchDocuments, EMPTY_FILTERS, excerpt, filterDocuments, filterOptions, rankDocuments, readFilters, searchUrl } from '../src/lib/search.ts';
import { semanticSearch, SEARCH_CANDIDATES } from '../src/lib/semantic-search.ts';
import { createSearchHandler } from '../src/lib/search-handler.ts';
import { TOPICS } from '../src/lib/topic-taxonomy.ts';
import { readSermons } from '../scripts/discovery-content.mjs';
import { currentDiscovery } from '../src/lib/discovery-core.ts';

const source = (id, data = {}, body = 'A published paragraph with enough text to be included in the searchable sermon transcript.') => ({
  id: `sermon-${id}`, body, data: { archiveId: id, sermonDate: '2026-01-01', title: `Sermon ${id}`, preacher: 'Unknown preacher', theme: null, scriptureReference: null, liturgicalDay: null, sermonType: null, tags: [], sourceVideoId: `video-${id}`, ...data }
});
const docs = (entries, topics = new Map()) => createSearchDocuments(entries, topics);
const decision = (level) => ({ score: level, confidence: 1, probabilities: { [level]: 1 } });
const answers = (questions, level = 0) => Object.fromEntries(Object.keys(questions).map((key) => [key, decision(level)]));

const refs = value => parseScripture(value);
test('Scripture aliases, numbered books, ranges and inherited verse lists retain their meaning', () => {
  assert.equal(refs('Matt. 5')[0].book, 'matthew');
  assert.deepEqual(refs('1 John 1:1–2:3'), [{ book: '1-john', chapter: 1, lastChapter: 2, verse: 1, lastVerse: 3 }]);
  assert.deepEqual(refs('Genesis 6–9'), [{ book: 'genesis', chapter: 6, lastChapter: 9, verse: undefined, lastVerse: undefined }]);
  const list = refs('Matthew 13:24–30; 36–43; John 3:16, 18');
  assert.deepEqual(list.map(x => [x.book, x.chapter, x.verse, x.lastVerse]), [['matthew',13,24,30],['matthew',13,36,43],['john',3,16,16],['john',3,18,18]]);
  assert.equal(refs('Matthews wrote it').length, 0);
  assert.equal(refs('Matthew 0:1').length, 0);
});

test('Scripture matching respects verse and cross-chapter boundaries without inventing chapters', () => {
  assert(passagesOverlap(refs('John 6:15–21')[0], refs('Jn. 6:20')[0]));
  assert(!passagesOverlap(refs('John 6:15–21')[0], refs('John 6:22')[0]));
  assert(passagesOverlap(refs('John 1:14–2:3')[0], refs('John 2:2')[0]));
  assert(!passagesOverlap(refs('John 1:14–2:3')[0], refs('John 2:4')[0]));
  assert(!passagesOverlap(refs('John (alluded to)')[0], refs('John 6')[0]));
  assert(!passagesOverlap(refs('1 John 1')[0], refs('John 1')[0]));
  assert.equal(parseScripture('Matthew 5:3 (Beatitudes)').length, 1, 'source annotation does not fabricate Luke references');
  assert.equal(parseScripture('Beatitudes', true).length, 2, 'query alias finds both Gospel accounts');
  assert.equal(parseScripture('How do I find purpose in a difficult job?', true).length, 0, 'ordinary language does not become a Book of Job query');
  assert.equal(parseScripture('the book of Job', true)[0].book, 'job');
});

test('filters combine and preserve uncertainty and recorded calendar designations', () => {
  const corpus = docs([
    source(1, { preacher: 'Rev. Fr. Mesrop Ash', scriptureReference: 'Matthew 5:3', liturgicalDay: 'Sunday of the Advent — last Sunday of Great Lent before Palm Sunday' }),
    source(2, { preacher: 'Der Mesrop', scriptureReference: 'Matthew (Gospel reading)', liturgicalDay: 'Midpoint of Advent (Hisnag)' }),
    source(3, { preacher: 'Unidentified parish priest', scriptureReference: 'Matthew 5:5', sermonDate: '2025-01-01', liturgicalDay: 'Second Palm Sunday (Sunday after Ascension)' })
  ], new Map([[1, ['prayer']]]));
  assert.deepEqual(filterDocuments(corpus, { ...EMPTY_FILTERS, book: 'matthew', chapter: '5', year: '2026', season: 'lent', preacher: 'Fr. Mesrop Ash', topic: 'prayer' }).map(x=>x.archiveId), [1]);
  assert.equal(corpus.find(x=>x.archiveId===3).preacherKey, 'Preacher not identified');
  assert(!corpus.find(x=>x.archiveId===1).seasons.includes('advent'));
  assert(!corpus.find(x=>x.archiveId===3).seasons.includes('holy-week'));
  assert.deepEqual(filterDocuments(corpus, { ...EMPTY_FILTERS, chapter: '5' }), []);
  assert.deepEqual(filterDocuments(corpus, { ...EMPTY_FILTERS, book: 'matthew', chapter: 'bogus' }), []);
  assert.equal(filterOptions(corpus).preachers.filter(x=>x==='Fr. Mesrop Ash').length, 1);
});

test('search uses transcript-only words and returns a verbatim excerpt', () => {
  const body = 'A quiet practice of patience can overcome resentment and bitterness. We must learn to listen with compassion before we speak.';
  const corpus = docs([source(1, {}, body), source(2, {}, 'This is an unrelated paragraph about beautiful architecture and planning a building project.')]);
  const results = rankDocuments(corpus, 'bitterness');
  assert.deepEqual(results.map(x=>x.id), ['sermon-1']);
  assert.equal(results[0].excerpt, body);
  assert.deepEqual(rankDocuments(corpus, 'qzxvnotaword'), []);
  assert(body.includes(excerpt(body, 'compassion', 70).replace(/^…|…$/g, '')));
});

test('Scripture search finds abbreviations and Beatitudes without requiring literal title words', () => {
  const corpus = docs([source(1, { scriptureReference: 'Matthew 5:3–12' }), source(2, { scriptureReference: 'John 5' })]);
  assert.deepEqual(rankDocuments(corpus, 'Matt. 5').map(x=>x.id), ['sermon-1']);
  assert.deepEqual(rankDocuments(corpus, 'Beatitudes').map(x=>x.id), ['sermon-1']);
});

test('shareable URLs retain every filter and safely encode a question', () => {
  const filters = { ...EMPTY_FILTERS, book: 'matthew', chapter: '5', year: '2026', preacher: 'Fr. Mesrop Ash' };
  const url = searchUrl(2, 'prayer & hope?', filters);
  const params = new URL(url, 'https://example.com').searchParams;
  assert.deepEqual(readFilters(params), filters);
  assert.equal(params.get('q'), 'prayer & hope?');
  assert.equal(params.get('page'), '2');
  assert.equal(searchUrl(3, '', EMPTY_FILTERS), '/page/3/');
});

test('Clef reranks a bounded shortlist and chooses the supporting passage', async () => {
  const corpus = docs(Array.from({ length: 20 }, (_, i) => source(i+1, {}, 'The practice of forgiveness helps us release resentment and seek reconciliation without denying the harm that occurred.')), new Map(Array.from({length:20},(_,i)=>[i+1,['forgiveness']])));
  let calls = 0;
  const result = await semanticSearch(corpus, 'How do I let go of bitterness?', EMPTY_FILTERS, async (state, questions) => {
    calls++;
    if (calls===1) return { answers: { ...answers(questions), forgiveness: decision(3) } };
    assert.equal(JSON.parse(state).sermons.length, SEARCH_CANDIDATES);
    assert(Object.keys(questions).length <= 24);
    return { answers: { ...answers(questions), s0p0: decision(3), s1p0: decision(2) } };
  });
  assert.equal(calls, 2);
  assert.equal(result.mode, 'clef');
  assert.equal(result.hits.length, 2);
  assert(result.hits[0].excerpt.includes('without denying the harm'));
});

test('Clef applies filters before inference and never forces unrelated recommendations', async () => {
  const corpus = docs([source(1, { sermonDate: '2026-01-01' }, 'Forgiveness is a spiritual practice that we must learn in our everyday lives.'), source(2, { sermonDate: '2025-01-01' })]);
  let calls = 0;
  const result = await semanticSearch(corpus, 'forgiveness', { ...EMPTY_FILTERS, year: '2026' }, async (state, questions) => {
    calls++;
    if (calls===2) assert.equal(JSON.parse(state).sermons.length, 1);
    return { answers: answers(questions) };
  });
  assert.deepEqual(result.hits, []);
  assert.equal(calls, 2);
  await assert.rejects(semanticSearch(corpus, 'forgiveness', EMPTY_FILTERS, async()=>({answers:{}})), /Invalid Clef/);
});

test('explicit Scripture queries bypass paid inference', async () => {
  const corpus = docs([source(1, { scriptureReference: 'Matthew 5' })]);
  const result = await semanticSearch(corpus, 'Matt. 5', EMPTY_FILTERS, async()=>{throw new Error('Must not call provider');});
  assert.equal(result.hits.length, 1);
  assert.equal(result.mode, 'transcript');
});

const request = (body, headers = {}) => new Request('https://sermons.mesropash.com/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body==='string' ? body : JSON.stringify(body) });
test('public handler rejects malformed, oversized and cross-site requests before provider work', async () => {
  let calls = 0;
  const handler = createSearchHandler({ documents: async()=>[], client: ()=>{calls++;return async()=>({answers:{}});} });
  assert.equal((await handler(new Request('https://example.com/api/search'))).status,405);
  assert.equal((await handler(request('{broken'))).status,400);
  assert.equal((await handler(request({query:'x'.repeat(241)}))).status,400);
  assert.equal((await handler(request('x'.repeat(2049)))).status,413);
  assert.equal((await handler(request({query:'prayer'}, {Origin:'https://evil.example'}))).status,403);
  assert.equal((await handler(request({query:'prayer',filters:{unknown:'yes'}}))).status,400);
  assert.equal((await handler(request({query:'prayer',filters:{year:2026}}))).status,400);
  assert.equal(calls,0);
});

test('handler degrades safely, keeps questions uncached, and limits repeated inference', async () => {
  const unavailable=createSearchHandler({documents:async()=>[],client:()=>null});
  assert.equal((await unavailable(request({query:'prayer'}))).status,503);
  const handler=createSearchHandler({documents:async()=>[],client:()=>async()=>({answers:{}})});
  for(let i=0;i<6;i++) {
    const response=await handler(request({query:'prayer'}));
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
  }
  assert.equal((await handler(request({query:'prayer'}))).status,429);
});

test('real archive indexes every published transcript and preserves known Scripture and topic links', async () => {
  const entries=await readSermons('src/content/sermons');
  const discovery=currentDiscovery(entries,JSON.parse(await readFile('src/data/discovery.json','utf8')));
  const corpus=docs(entries,new Map([...discovery].map(([id,r])=>[id,r.topics.map(t=>t.id)])));
  assert.equal(corpus.length,entries.length);
  assert(corpus.every(doc=>doc.passages.length>0));
  assert(filterDocuments(corpus,{...EMPTY_FILTERS,book:'matthew',chapter:'5'}).length>0);
  assert(rankDocuments(corpus,'Why is prayer difficult?').length>0);
  assert(corpus.every(doc=>doc.topics.every(id=>TOPICS.some(t=>t.id===id))));
});
