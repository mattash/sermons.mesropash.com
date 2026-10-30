import { EMPTY_FILTERS, MAX_QUERY_LENGTH, readFilters, type SearchDocument } from "./search.ts";
import { semanticSearch, type Decide } from "./semantic-search.ts";

interface Dependencies {
  documents: () => Promise<SearchDocument[]>;
  client: (signal: AbortSignal) => Decide | null;
}

export function createSearchHandler(deps: Dependencies) {
  // Best-effort instance guard. Platform firewall rules provide shared rate limits.
  const requests = new Map<string, { count: number; expires: number }>();
  let active = 0;
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Use search on this site." }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Expected JSON." }, 415);
    let input: { query?: unknown; filters?: unknown };
    try {
      const reader = request.body?.getReader();
      if (!reader) return json({ error: "Enter a question." }, 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2048) { await reader.cancel(); return json({ error: "Search request is too long." }, 413); }
        chunks.push(value);
      }
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid JSON");
    } catch { return json({ error: "Invalid search request." }, 400); }
    if (typeof input.query !== "string" || !input.query.trim() || input.query.length > MAX_QUERY_LENGTH) return json({ error: `Enter a question of up to ${MAX_QUERY_LENGTH} characters.` }, 400);
    if (input.filters !== undefined && (!input.filters || typeof input.filters !== "object" || Array.isArray(input.filters))) return json({ error: "Invalid filters." }, 400);
    const filterParams = new URLSearchParams();
    for (const [key, value] of Object.entries(input.filters ?? {})) {
      if (!Object.hasOwn(EMPTY_FILTERS, key) || typeof value !== "string" || value.length > 100) return json({ error: "Invalid filters." }, 400);
      filterParams.set(key, value);
    }
    const client = deps.client(request.signal);
    if (!client) return json({ error: "Topic search is temporarily unavailable." }, 503);
    const now = Date.now();
    for (const [key, bucket] of requests) if (bucket.expires < now) requests.delete(key);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
    const bucket = requests.get(ip) ?? { count: 0, expires: now + 60_000 };
    if (bucket.count >= 6 || active >= 4 || requests.size >= 2000) return json({ error: "Please wait a moment before searching again." }, 429);
    bucket.count++;
    requests.set(ip, bucket);
    active++;
    try {
      return json(await semanticSearch(await deps.documents(), input.query.trim(), readFilters(filterParams), client));
    } catch {
      // Never log the pastoral question, transcript, provider body, or credentials.
      console.warn("sermon_search_unavailable");
      return json({ error: "Topic search is temporarily unavailable." }, 503);
    } finally { active--; }
  };
}
