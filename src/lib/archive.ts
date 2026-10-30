export const PAGE_SIZE = 12;

export interface SermonSummary {
  id: string;
  data: {
    sermonDate: string;
    title: string;
    preacher: string;
    theme: string | null;
    scriptureReference: string | null;
    liturgicalDay: string | null;
    sermonType: string | null;
    tags: string[];
  };
}

export function sortSermons<T extends SermonSummary>(sermons: T[]): T[] {
  return [...sermons].sort((a, b) =>
    b.data.sermonDate.localeCompare(a.data.sermonDate) || a.id.localeCompare(b.id)
  );
}

export function paginate<T>(items: T[], requestedPage = 1) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Number.isFinite(requestedPage)
    ? Math.max(1, Math.min(totalPages, Math.floor(requestedPage)))
    : 1;
  const offset = (page - 1) * PAGE_SIZE;
  return {
    items: items.slice(offset, offset + PAGE_SIZE),
    page,
    totalPages,
    total: items.length,
    start: items.length ? offset + 1 : 0,
    end: Math.min(offset + PAGE_SIZE, items.length)
  };
}

export function archivePageUrl(page: number, query = ""): string {
  if (query.trim()) {
    const params = new URLSearchParams({ q: query.trim() });
    if (page > 1) params.set("page", String(page));
    return `/?${params}`;
  }
  return page > 1 ? `/page/${page}/` : "/";
}

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}

export function searchSermons<T extends SermonSummary>(sermons: T[], query: string): T[] {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return sermons.filter(({ data }) => {
    const text = normalize([
      data.sermonDate, data.title, data.preacher, data.theme,
      data.scriptureReference, data.liturgicalDay, data.sermonType, ...data.tags
    ].filter(Boolean).join(" "));
    return terms.every((term) => text.includes(term));
  });
}
