import { paginate } from "../lib/archive";
import { EMPTY_FILTERS, MAX_QUERY_LENGTH, filterDocuments, hasFilters, rankDocuments, readFilters, searchUrl, type ArchiveFilters, type SearchDocument, type SearchHit, type SearchResult } from "../lib/search";
import { formatSermonDate } from "../lib/sermons";
import { parseScripture } from "../lib/scripture";

function initializeSearch() {
  const form = document.querySelector<HTMLFormElement>("[data-sermon-search-form]");
  const input = document.querySelector<HTMLInputElement>("#sermon-search");
  const list = document.querySelector<HTMLElement>("[data-sermon-list]");
  const status = document.querySelector<HTMLElement>("#sermon-search-status");
  const empty = document.querySelector<HTMLElement>("[data-search-empty]");
  const pagination = document.querySelector<HTMLElement>("[data-pagination]");
  const reset = document.querySelector<HTMLButtonElement>("[data-search-reset]");
  const filtersPanel = document.querySelector<HTMLDetailsElement>("[data-search-filters]");
  const submit = form?.querySelector<HTMLButtonElement>("button[type=submit]");
  const firstCard = list?.querySelector<HTMLElement>("[data-sermon-card]");
  if (!form || !input || !list || !status || !empty || !pagination || !reset || !submit || !firstCard) return;
  const fields = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-filter]")];
  const chapter = fields.find((field) => field.name === "chapter") as HTMLInputElement;
  const book = fields.find((field) => field.name === "book")!;
  const cardTemplate = firstCard.cloneNode(true) as HTMLElement;
  const pageLinkClass = pagination.dataset.pageLinkClass ?? "";
  let indexPromise: Promise<SearchDocument[]> | undefined;
  let requestVersion = 0;
  let timer: ReturnType<typeof setTimeout>;
  let controller: AbortController | undefined;
  const results = new Map<string, SearchResult>();

  function loadIndex() {
    indexPromise ??= fetch("/search.json").then(async (response) => {
      if (!response.ok) throw new Error("Search index unavailable");
      return await response.json() as SearchDocument[];
    }).catch((error) => { indexPromise = undefined; throw error; });
    return indexPromise;
  }
  function currentFilters(): ArchiveFilters {
    return { ...EMPTY_FILTERS, ...Object.fromEntries(fields.map((field) => [field.name, field.value])) };
  }
  function syncFilters() {
    chapter.disabled = !book.value;
    chapter.placeholder = book.value ? "Any chapter" : "Choose a book first";
    if (!book.value) chapter.value = "";
    const count = Object.values(currentFilters()).filter(Boolean).length;
    const counter = document.querySelector<HTMLElement>("[data-filter-count]");
    if (counter) counter.textContent = count ? `(${count} active)` : "";
    reset!.hidden = !count && !input!.value.trim();
  }
  function makeCard(entry: SearchDocument, hit: SearchHit) {
    const card = cardTemplate.cloneNode(true) as HTMLElement;
    const title = card.querySelector<HTMLAnchorElement>("[data-card-title]")!;
    title.textContent = entry.data.title;
    title.href = `/sermons/${entry.id}/`;
    const values = { date: formatSermonDate(entry.data.sermonDate), preacher: entry.data.preacher, theme: entry.data.theme, scripture: entry.data.scriptureReference };
    for (const [field, value] of Object.entries(values)) {
      const element = card.querySelector<HTMLElement>(`[data-card-${field}]`)!;
      element.textContent = value ?? "";
      element.hidden = !value;
    }
    const quote = card.querySelector<HTMLElement>("[data-card-excerpt]")!;
    quote.hidden = !hit.excerpt;
    quote.querySelector<HTMLElement>("[data-card-excerpt-text]")!.textContent = hit.excerpt;
    return card;
  }
  function renderPagination(page: number, totalPages: number, query: string, filters: ArchiveFilters) {
    const fragment = document.createDocumentFragment();
    function addLink(number: number, text: string, relation?: string) {
      const link = document.createElement("a");
      link.className = pageLinkClass;
      link.textContent = text;
      link.href = searchUrl(number, query, filters);
      link.dataset.searchPage = String(number);
      if (relation) link.rel = relation;
      else link.setAttribute("aria-label", `Page ${number}`);
      if (number === page && !relation) link.setAttribute("aria-current", "page");
      fragment.append(link);
    }
    if (page > 1) addLink(page - 1, "← Previous", "prev");
    for (let number = 1; number <= totalPages; number++) addLink(number, String(number));
    if (page < totalPages) addLink(page + 1, "Next →", "next");
    pagination!.replaceChildren(fragment);
    pagination!.hidden = totalPages <= 1;
  }
  function render(result: SearchResult, docs: SearchDocument[], query: string, filters: ArchiveFilters, requestedPage: number, focus: boolean) {
    const byId = new Map(docs.map((doc) => [doc.id, doc]));
    const matches = paginate(result.hits.filter((hit) => byId.has(hit.id)), requestedPage);
    list!.replaceChildren(...matches.items.map((hit) => makeCard(byId.get(hit.id)!, hit)));
    list!.hidden = false;
    list!.removeAttribute("aria-busy");
    empty!.hidden = matches.total > 0;
    const range = `Showing ${matches.start}–${matches.end} of ${matches.total}`;
    status!.textContent = result.mode === "clef"
      ? matches.total ? `${matches.total} closest ${matches.total === 1 ? "match" : "matches"} for “${query}”` : `No close matches for “${query}”. Try a broader question or fewer filters.`
      : matches.total ? `${range} sermons${query ? ` matching “${query}”` : ""}${hasFilters(filters) ? " with these filters" : ""} · Page ${matches.page} of ${matches.totalPages}` : "No sermons match this search and these filters.";
    renderPagination(matches.page, matches.totalPages, query, filters);
    history.replaceState(null, "", searchUrl(matches.page, query, filters));
    if (focus) { list!.focus({ preventScroll: true }); list!.scrollIntoView({ behavior: "auto", block: "start" }); }
  }
  async function updateResults(requestedPage = 1, focusResults = false, useClef = true) {
    const version = ++requestVersion;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const query = input!.value.trim().slice(0, MAX_QUERY_LENGTH);
    const filters = currentFilters();
    const key = JSON.stringify({ query, filters });
    syncFilters();
    submit!.disabled = false;
    submit!.textContent = "Search";
    status!.textContent = "Searching all sermons…";
    list!.setAttribute("aria-busy", "true");
    try {
      const docs = filterDocuments(await loadIndex(), filters);
      if (version !== requestVersion) return;
      const cached = results.get(key);
      const fallback: SearchResult = query ? { hits: rankDocuments(docs, query), mode: "transcript" } : { hits: docs.map(({ id }) => ({ id, excerpt: "", score: 0 })), mode: "browse" };
      render(cached ?? fallback, docs, query, filters, requestedPage, focusResults);
      if (!query || cached || !useClef || !docs.length || parseScripture(query, true).length) return;
      submit!.disabled = true;
      submit!.textContent = "Searching…";
      list!.setAttribute("aria-busy", "true");
      status!.textContent = "Looking for sermons that address your question…";
      try {
        const response = await fetch("/api/search", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, filters }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(28_000)])
        });
        if (!response.ok) throw new Error("Question search unavailable");
        const result = await response.json() as SearchResult;
        if (!Array.isArray(result.hits) || !["clef", "transcript"].includes(result.mode)) throw new Error("Invalid search response");
        const seen = new Set<string>();
        result.hits = result.hits.filter((hit) => typeof hit.id === "string" && docs.some((doc) => doc.id === hit.id) && typeof hit.excerpt === "string" && hit.excerpt.length <= 500 && !seen.has(hit.id) && !!seen.add(hit.id));
        if (version !== requestVersion) return;
        if (results.size >= 20) results.delete(results.keys().next().value!);
        results.set(key, result);
        render(result, docs, query, filters, requestedPage, focusResults);
      } catch {
        if (version !== requestVersion) return;
        status!.textContent = `${fallback.hits.length ? "Showing transcript matches." : "No transcript matches."} Question search is temporarily unavailable. You can try Search again.`;
      } finally {
        if (version === requestVersion) { submit!.disabled = false; submit!.textContent = "Search"; list!.removeAttribute("aria-busy"); }
      }
    } catch {
      if (version !== requestVersion) return;
      list!.removeAttribute("aria-busy");
      list!.hidden = true;
      pagination!.hidden = true;
      empty!.hidden = true;
      status!.textContent = "Search is temporarily unavailable. Please try again.";
    }
  }
  input.addEventListener("input", () => {
    ++requestVersion;
    controller?.abort();
    submit!.disabled = false;
    submit!.textContent = "Search";
    clearTimeout(timer);
    timer = setTimeout(() => void updateResults(1, false, false), 350);
  });
  form.addEventListener("submit", (event) => { event.preventDefault(); clearTimeout(timer); void updateResults(); });
  for (const field of fields) field.addEventListener("change", () => { syncFilters(); clearTimeout(timer); void updateResults(); });
  reset.addEventListener("click", () => {
    input.value = "";
    for (const field of fields) field.value = "";
    syncFilters();
    clearTimeout(timer);
    void updateResults(1, true, false);
  });
  for (const button of form.querySelectorAll<HTMLButtonElement>("[data-search-question]")) button.addEventListener("click", () => {
    input.value = button.dataset.searchQuestion ?? "";
    clearTimeout(timer);
    void updateResults(1, true);
  });
  pagination.addEventListener("click", (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[data-search-page]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    history.pushState(null, "", link.href);
    void updateResults(Number(link.dataset.searchPage), true, false);
  });
  function restoreSearch() {
    clearTimeout(timer);
    const params = new URLSearchParams(window.location.search);
    input!.value = (params.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);
    const filters = readFilters(params);
    for (const field of fields) field.value = filters[field.name as keyof ArchiveFilters];
    syncFilters();
    if (filtersPanel && hasFilters(filters)) filtersPanel.open = true;
    const pathPage = window.location.pathname.match(/^\/page\/(\d+)\/?$/)?.[1];
    void updateResults(Number(params.get("page") ?? pathPage ?? 1));
  }
  window.addEventListener("popstate", restoreSearch);
  const params = new URLSearchParams(window.location.search);
  if (params.get("q")?.trim() || hasFilters(readFilters(params))) restoreSearch();
}

initializeSearch();
