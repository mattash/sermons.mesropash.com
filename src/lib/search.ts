import { TOPICS } from "./topic-taxonomy.ts";
import { BIBLE_BOOKS, parseScripture, passagesOverlap, type ScripturePassage } from "./scripture.ts";
import { sortSermons, type SermonSummary } from "./archive.ts";

export const MAX_QUERY_LENGTH = 240;
export const SEASONS = [
  { id: "lent", label: "Lent & preparation", pattern: /lent|pareg[ae]nt|paregant|paregantan|paregantain|barekendan|catechumens/i },
  { id: "holy-week", label: "Palm Sunday & Holy Week", pattern: /(?<!second )palm sunday|holy week|holy thursday|maundy|good friday/i },
  { id: "easter", label: "Easter & Ascension", pattern: /easter|resurrection|ascension|red sunday|green sunday|new sunday|krknazadik|blind man/i },
  { id: "pentecost", label: "Pentecost & following Sundays", pattern: /pentecost|descent of the holy spirit|elijah|elysian/i },
  { id: "transfiguration", label: "Transfiguration & surrounding Sundays", pattern: /transfiguration|var[dt]avar/i },
  { id: "assumption", label: "Assumption & surrounding Sundays", pattern: /assumption|dormition|verapokhoum/i },
  { id: "holy-cross", label: "Holy Cross feasts & following Sundays", pattern: /holy cross|khach|khachi/i },
  { id: "nativity", label: "Nativity & Theophany", pattern: /nativity|theophany|christmas|epiphany|naming of jesus/i },
  { id: "advent", label: "Advent (Hisnag)", pattern: /hisnag|advent/i },
  { id: "saints", label: "Saints & church feasts", pattern: /saint|\bst\.|holy evangelists|etchmiadzin|diarantarad|dyarndaraj|presentation of (christ|our lord)/i }
] as const;

export interface ArchiveFilters { book: string; chapter: string; season: string; year: string; preacher: string; topic: string }
export const EMPTY_FILTERS: ArchiveFilters = { book: "", chapter: "", season: "", year: "", preacher: "", topic: "" };
export interface SearchDocument extends SermonSummary {
  archiveId: number;
  passages: string[];
  scripture: ScripturePassage[];
  seasons: string[];
  preacherKey: string;
  topics: string[];
}
export interface SearchHit { id: string; excerpt: string; score: number }
export interface SearchResult { hits: SearchHit[]; mode: "clef" | "transcript" | "browse" }

export function preacherGroup(value: string): string {
  if (/;|\band archbishop\b|\(der hayk\)/i.test(value)) return "Multiple or uncertain preachers";
  if (/\bmesrop\b/i.test(value)) return "Fr. Mesrop Ash";
  if (/\b(?:telfayan|telfeyan)\b/i.test(value)) return "Fr. Garabed Telfayan";
  if (/\bsarkis\b/i.test(value)) return "Fr. Sarkis";
  if (/\bavetis\b/i.test(value)) return "Fr. Avetis";
  if (/\bartsakh\b/i.test(value)) return "Fr. Artsakh";
  if (/\bcharles cherezian\b/i.test(value)) return "Dn. Charles Cherezian";
  if (/unknown|unidentified|unnamed|not (?:identified|explicitly|named)|name not|name not specified|parish priest|substitute priest/i.test(value)) return "Preacher not identified";
  return value || "Preacher not identified";
}

export function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\s*-]+/gm, "").replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
}

export function createSearchDocuments(entries: (SermonSummary & { body?: string; data: SermonSummary["data"] & { archiveId: number } })[], topicsById: Map<number, string[]>): SearchDocument[] {
  return sortSermons(entries).map((entry) => {
    const day = entry.data.liturgicalDay ?? "";
    const seasons: string[] = SEASONS.filter((season) => season.pattern.test(day) && !(season.id === "advent" && /lent/i.test(day))).map(({ id }) => id);
    if (!seasons.length) seasons.push("other");
    return {
      id: entry.id, data: entry.data, archiveId: entry.data.archiveId,
      passages: (entry.body ?? "").split(/\n\s*\n/).map(plainText).filter((text) => text.length > 35),
      scripture: parseScripture(entry.data.scriptureReference), seasons,
      preacherKey: preacherGroup(entry.data.preacher), topics: topicsById.get(entry.data.archiveId) ?? []
    };
  });
}

export function readFilters(params: URLSearchParams): ArchiveFilters {
  return Object.fromEntries(Object.keys(EMPTY_FILTERS).map((key) => [key, (params.get(key) ?? "").trim().slice(0, 100)])) as unknown as ArchiveFilters;
}
export function hasFilters(filters: ArchiveFilters): boolean { return Object.values(filters).some(Boolean); }
export function searchUrl(page: number, query: string, filters: ArchiveFilters, sort = ""): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim().slice(0, MAX_QUERY_LENGTH));
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (["newest", "oldest", "relevance"].includes(sort)) params.set("sort", sort);
  if (!params.size) return page > 1 ? `/page/${page}/` : "/";
  if (page > 1) params.set("page", String(page));
  return `/?${params}`;
}

export function filterDocuments(documents: SearchDocument[], filters: ArchiveFilters): SearchDocument[] {
  return documents.filter((doc) => (!filters.book || doc.scripture.some((passage) => passagesOverlap(passage, {
    book: filters.book, chapter: filters.chapter ? Number(filters.chapter) : undefined
  }))) && (!filters.chapter || (!!filters.book && /^\d{1,3}$/.test(filters.chapter) && Number(filters.chapter) > 0))
    && (!filters.season || doc.seasons.includes(filters.season))
    && (!filters.year || doc.data.sermonDate.startsWith(`${filters.year}-`))
    && (!filters.preacher || doc.preacherKey === filters.preacher)
    && (!filters.topic || doc.topics.includes(filters.topic)));
}

export function filterOptions(documents: SearchDocument[]) {
  const books = new Set(documents.flatMap((doc) => doc.scripture.map(({ book }) => book)));
  return {
    books: BIBLE_BOOKS.filter(({ id }) => books.has(id)),
    seasons: [...SEASONS.filter(({ id }) => documents.some((doc) => doc.seasons.includes(id))).map(({ id, label }) => ({ id: String(id), label: String(label) })), { id: "other", label: "Other Sundays & services" }],
    years: [...new Set(documents.map((doc) => doc.data.sermonDate.slice(0, 4)))].sort().reverse(),
    preachers: [...new Set(documents.map((doc) => doc.preacherKey))].sort()
  };
}

const STOP = new Set("a an the and or but to of in on for with from by at as is are was were be been being i me my m t s we us our you your he him his she her they their it its this that these those how do does did can could should would will what why when where who whom about someone something keep keeps really please sermon sermons find help god jesus christ lord church".split(" "));
export function normalize(value: string): string { return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase(); }
function stem(term: string): string {
  if (/^forgiv/.test(term)) return "forgiv";
  if (/^(?:worri|worry|anxi|anxious|afraid|scared)/.test(term)) return "anxiety";
  if (/^pray/.test(term)) return "pray";
  return term.length > 5 ? term.replace(/(?:ing|ness|ed|es|s)$/, "") : term.replace(/s$/, "");
}
export function terms(value: string): string[] { return normalize(value).match(/[\p{L}\p{N}]+/gu)?.filter((word) => !STOP.has(word)).map(stem) ?? []; }

export function queryTopics(query: string): string[] {
  const words = new Set(terms(query));
  return TOPICS.filter((topic) => [topic.label, ...topic.aliases].some((alias) => {
    const tokens = terms(alias);
    return tokens.length && tokens.every((word) => words.has(word));
  })).map(({ id }) => id);
}

export function needsSemanticSearch(documents: SearchDocument[], query: string): boolean {
  if (parseScripture(query, true).length || /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(query.trim())) return false;
  const name = normalize(query).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (name.length >= 3 && documents.some((doc) => normalize(doc.preacherKey).replace(/[^\p{L}\p{N}]+/gu, " ").includes(name))) return false;
  return true;
}

export function passageCandidates(doc: SearchDocument, query: string, topicIds: string[] = [], max = 3): string[] {
  const words = new Set(terms([query, ...TOPICS.filter(({ id }) => topicIds.includes(id)).map((topic) => `${topic.label} ${topic.aliases.join(" ")}`)].join(" ")));
  return doc.passages.map((text, index) => { const tokens = terms(text); return { text, index, score: tokens.reduce((sum, word) => sum + (words.has(word) ? 1 : 0), 0) / Math.sqrt(Math.max(tokens.length, 20)) }; })
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, max).map(({ text }) => text);
}

export function excerpt(text: string, query = "", length = 380): string {
  if (text.length <= length) return text;
  const words = new Set(terms(query));
  // Choose a window near a matching word, always preserving a verbatim source span.
  const tokens = [...text.matchAll(/[\p{L}\p{N}]+/gu)];
  const hit = tokens.find((token) => words.has(stem(normalize(token[0]))));
  let start = Math.max(0, (hit?.index ?? 0) - 90);
  if (start) { const nextSpace = text.indexOf(" ", start); start = nextSpace < 0 ? start : nextSpace + 1; }
  let end = Math.min(text.length, start + length);
  if (end < text.length) { const space = text.lastIndexOf(" ", end); if (space > start) end = space; }
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

const prepared = new WeakMap<SearchDocument, { fields: { counts: Map<string, number>; boost: number }[]; all: Set<string> }>();
function prepare(doc: SearchDocument) {
  const cached = prepared.get(doc);
  if (cached) return cached;
  const sources: [string, number][] = [[doc.data.title, 6], [doc.data.theme ?? "", 3], [doc.data.tags.join(" "), 1.2], [doc.data.preacher, 2], [doc.data.sermonDate, 4], [doc.data.scriptureReference ?? "", 2], [doc.data.liturgicalDay ?? "", 2], [doc.data.sermonType ?? "", 1], [doc.passages.join(" "), 1]];
  const all = new Set<string>();
  const fields = sources.map(([text, boost]) => {
    const counts = new Map<string, number>();
    for (const term of terms(text)) { counts.set(term, (counts.get(term) ?? 0) + 1); all.add(term); }
    return { counts, boost };
  });
  const value = { fields, all };
  prepared.set(doc, value);
  return value;
}

export function rankDocuments(documents: SearchDocument[], query: string, topicIds = queryTopics(query)): SearchHit[] {
  const words = [...new Set(terms(query))];
  const refs = parseScripture(query, true);
  const frequency = new Map(words.map((word) => [word, documents.filter((doc) => prepare(doc).all.has(word)).length]));
  const hits = documents.map((doc) => {
    const { fields } = prepare(doc);
    let score = 0;
    let matched = 0;
    for (const word of words) {
      let weight = 0;
      for (const { counts, boost } of fields) {
        const count = counts.get(word) ?? 0;
        if (count) weight += boost * (count / (count + 1.2));
      }
      if (weight) { matched++; score += weight * Math.log(1 + (documents.length + 1) / (1 + (frequency.get(word) ?? 0))); }
    }
    score *= words.length ? .5 + .5 * matched / words.length : 1;
    const referenceMatch = refs.some((ref) => doc.scripture.some((source) => passagesOverlap(source, ref)));
    if (refs.length && !referenceMatch) return null;
    if (referenceMatch) score += 18;
    score += doc.topics.filter((id) => topicIds.includes(id)).length * 5;
    if (!score && words.length) return null;
    if (!words.length && !refs.length && query.trim()) return null;
    return { id: doc.id, score, excerpt: excerpt(passageCandidates(doc, query, topicIds, 1)[0] ?? doc.data.theme ?? "", query) };
  }).filter((hit): hit is SearchHit => hit !== null);
  return hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
