import { archivePageUrl, paginate, searchSermons, type SermonSummary } from "../lib/archive";
import { formatSermonDate } from "../lib/sermons";

function initializeSearch() {
  const form = document.querySelector<HTMLFormElement>("[data-sermon-search-form]");
  const input = document.querySelector<HTMLInputElement>("#sermon-search");
  const list = document.querySelector<HTMLElement>("[data-sermon-list]");
  const status = document.querySelector<HTMLElement>("#sermon-search-status");
  const empty = document.querySelector<HTMLElement>("[data-search-empty]");
  const pagination = document.querySelector<HTMLElement>("[data-pagination]");
  const firstCard = list?.querySelector<HTMLElement>("[data-sermon-card]");
  if (!form || !input || !list || !status || !empty || !pagination || !firstCard) return;

  const cardTemplate = firstCard.cloneNode(true) as HTMLElement;
  const pageLinkClass = pagination.dataset.pageLinkClass ?? "";
  let indexPromise: Promise<SermonSummary[]> | undefined;
  let requestVersion = 0;
  let timer: ReturnType<typeof setTimeout>;

  function loadIndex() {
    indexPromise ??= fetch("/search.json")
      .then(async (response) => {
        if (!response.ok) throw new Error("Search index unavailable");
        return await response.json() as SermonSummary[];
      })
      .catch((error) => {
        indexPromise = undefined;
        throw error;
      });
    return indexPromise;
  }

  function makeCard(entry: SermonSummary) {
    const card = cardTemplate.cloneNode(true) as HTMLElement;
    const title = card.querySelector<HTMLAnchorElement>("[data-card-title]")!;
    title.textContent = entry.data.title;
    title.href = `/sermons/${entry.id}/`;
    const fields = {
      date: formatSermonDate(entry.data.sermonDate),
      preacher: entry.data.preacher,
      theme: entry.data.theme,
      scripture: entry.data.scriptureReference
    };
    for (const [field, value] of Object.entries(fields)) {
      const element = card.querySelector<HTMLElement>(`[data-card-${field}]`)!;
      element.textContent = value ?? "";
      element.hidden = !value;
    }
    return card;
  }

  function renderPagination(page: number, totalPages: number, query: string) {
    const fragment = document.createDocumentFragment();
    function addLink(number: number, text: string, relation?: string) {
      const link = document.createElement("a");
      link.className = pageLinkClass;
      link.textContent = text;
      link.href = archivePageUrl(number, query);
      link.dataset.searchPage = String(number);
      if (relation) link.rel = relation;
      else link.setAttribute("aria-label", `Page ${number}`);
      if (number === page && !relation) {
        link.setAttribute("aria-current", "page");
      }
      fragment.append(link);
    }
    if (page > 1) addLink(page - 1, "← Previous", "prev");
    for (let number = 1; number <= totalPages; number++) addLink(number, String(number));
    if (page < totalPages) addLink(page + 1, "Next →", "next");
    pagination!.replaceChildren(fragment);
    pagination!.hidden = totalPages <= 1;
  }

  async function updateResults(requestedPage = 1, focusResults = false) {
    const version = ++requestVersion;
    const query = input!.value.trim();
    if (!query) {
      window.location.assign("/");
      return;
    }
    status!.textContent = "Searching all sermons…";
    list!.setAttribute("aria-busy", "true");
    list!.hidden = true;
    pagination!.hidden = true;
    empty!.hidden = true;
    try {
      const sermons = await loadIndex();
      if (version !== requestVersion) return;
      const result = paginate(searchSermons(sermons, query), requestedPage);
      list!.replaceChildren(...result.items.map(makeCard));
      list!.hidden = false;
      list!.removeAttribute("aria-busy");
      empty!.hidden = result.total > 0;
      status!.textContent = result.total
        ? `Showing ${result.start}–${result.end} of ${result.total} sermons matching “${query}” · Page ${result.page} of ${result.totalPages}`
        : `No sermons matching “${query}”`;
      renderPagination(result.page, result.totalPages, query);
      history.replaceState(null, "", archivePageUrl(result.page, query));
      if (focusResults) {
        list!.focus({ preventScroll: true });
        list!.scrollIntoView({ behavior: "auto", block: "start" });
      }
    } catch {
      if (version !== requestVersion) return;
      list!.removeAttribute("aria-busy");
      status!.textContent = "Search is temporarily unavailable. Please try again.";
    }
  }

  input.addEventListener("input", () => {
    ++requestVersion;
    clearTimeout(timer);
    timer = setTimeout(() => void updateResults(), 150);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearTimeout(timer);
    void updateResults();
  });
  pagination.addEventListener("click", (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[data-search-page]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    history.pushState(null, "", link.href);
    void updateResults(Number(link.dataset.searchPage), true);
  });
  function restoreSearch() {
    ++requestVersion;
    clearTimeout(timer);
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q");
    if (query?.trim()) {
      input!.value = query;
      void updateResults(Number(params.get("page") ?? 1));
    } else {
      window.location.assign("/");
    }
  }
  window.addEventListener("popstate", restoreSearch);
  if (new URLSearchParams(window.location.search).get("q")?.trim()) restoreSearch();
}

initializeSearch();
