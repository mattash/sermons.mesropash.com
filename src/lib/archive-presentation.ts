import { BIBLE_BOOKS, parseScripture } from "./scripture.ts";

export type ArchiveSort = "newest" | "oldest" | "relevance";

export function compactDate(value: string): string {
  const date = new Date(value + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return value || "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export function scripturePreview(value: string | null): string {
  if (!value) return "";
  const passage = parseScripture(value)[0];
  if (!passage) return value.split(/[;(]/)[0].trim();
  const book = BIBLE_BOOKS.find(({ id }) => id === passage.book)?.label ?? passage.book;
  if (!passage.chapter) return book;
  let reference = book + " " + passage.chapter;
  if (passage.verse) reference += ":" + passage.verse;
  if (passage.lastChapter && passage.lastChapter !== passage.chapter) reference += "–" + passage.lastChapter + (passage.lastVerse ? ":" + passage.lastVerse : "");
  else if (passage.lastVerse && passage.lastVerse !== passage.verse) reference += "–" + passage.lastVerse;
  return reference;
}

export function summaryPreview(value: string | null): string {
  if (!value) return "";
  for (const ending of value.matchAll(/[.!?](?:\s|$)/g)) {
    const sentence = value.slice(0, ending.index! + 1).trim();
    if (/\b(?:Fr|Rev|St|Mr|Dr)\.$/i.test(sentence)) continue;
    if (sentence.length <= 190) return sentence;
    break;
  }
  if (value.length <= 190) return value;
  const boundary = value.lastIndexOf(" ", 185);
  return value.slice(0, boundary > 100 ? boundary : 185).trimEnd() + "…";
}

export function pageNumbers(page: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const visible = new Set([1, total, page - 1, page, page + 1]);
  if (page <= 2) visible.add(3);
  if (page >= total - 1) visible.add(total - 2);
  const numbers = [...visible].filter((number) => number >= 1 && number <= total).sort((a, b) => a - b);
  const result: (number | null)[] = [];
  for (const number of numbers) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && number - previous > 1) result.push(null);
    result.push(number);
  }
  return result;
}

export function orderHits<T extends { id: string }>(hits: T[], documents: { id: string; data: { sermonDate: string } }[], order: ArchiveSort): T[] {
  if (order === "relevance") return hits;
  const dates = new Map(documents.map(({ id, data }) => [id, data.sermonDate]));
  return [...hits].sort((a, b) => {
    const comparison = (dates.get(a.id) ?? "").localeCompare(dates.get(b.id) ?? "");
    return (order === "oldest" ? comparison : -comparison) || a.id.localeCompare(b.id);
  });
}
