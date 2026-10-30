# Searching and filtering the sermon archive

## Visitor flow

The homepage offers six canonical topic shortcuts, example questions, and expandable filters. Queries, filters, and pagination are stored in the URL. Clearing the form returns to the newest sermons. Topics and static archive pagination remain usable without JavaScript.

Typing searches a lazily downloaded index of the complete published transcripts. Submitting a question also sends the question and active filters to the same-origin `POST /api/search` endpoint. The page first shows transcript matches, then replaces them with the closest semantic matches. A failed request leaves transcript results usable and offers another submission. Typing never starts paid inference. Session results are cached in memory for up to 20 query/filter combinations; they are not stored in localStorage.

## Ranking and source excerpts

`src/lib/search.ts` groups metadata and splits published Markdown into plain-text paragraphs. Weighted lexical retrieval uses titles, summaries, tags, metadata, full transcripts, simple word normalization, and canonical topic aliases. It ignores common stop words and general Christian vocabulary. It is a candidate-retrieval fallback rather than a semantic model.

For semantic search, Clef first judges which of the 27 canonical topics the question concerns. The server retrieves at most eight candidate sermons from the filtered corpus using those topics and lexical ranking. It sends at most three source passages per candidate to a second Clef request. Each passage is independently scored for substantive relevance; weak or unrelated passages do not qualify. The result is a ranked list, not a generated theological answer. Excerpts are literal spans from published text, with ellipses for omitted material, and are inserted into the DOM with `textContent`.

This two-stage search is bounded: it can miss a relevant sermon outside the shortlist or a relevant paragraph outside the three passage candidates. Armenian and English text are preserved, but English lexical retrieval does not translate Armenian. Evaluate changes against real questions and review excerpts; do not treat model scores as calibrated theological judgments.

## Scripture, calendar, and preacher normalization

`src/lib/scripture.ts` recognizes canonical book names, common English abbreviations, numbered epistles, chapters, verse ranges, cross-chapter ranges, and numeric continuations. “Matt. 5” matches recorded Matthew 5 passages. “Beatitudes” as a query also searches Matthew 5:1–12 and Luke 6:20–26. A book-only source allusion is not enough to assert a specific chapter. Source metadata is never changed or filled in from the query alias. Scripture queries are resolved locally without paid model calls.

Calendar groups use only the recorded liturgical-day field. They include surrounding/preparatory Sundays where the metadata says so. Lenten “Sunday of the Advent” is not grouped with Hisnag; Second Palm Sunday is grouped with Ascension rather than Holy Week. These are browsing groups rather than a calculated Armenian calendar.

Preacher filters group explicit name variants. Unknown or unnamed preachers remain unidentified. Mixed or uncertain attributions have their own group. The original attribution is still displayed on the sermon card and detail page. Source corrections belong in the private reviewed archive.

## Server deployment and credentials

`api/search.ts` is a standalone Node.js Vercel Function. The Astro site remains static. `vercel.json` includes published Markdown and discovery data in the function bundle; the corpus is loaded once per warm instance. Each deployment includes the latest published content, so the hourly publishing job also updates search.

Only these two variables are required in the Vercel production runtime:

- `CLOUDFLARE_WORKERSAI_API_KEY`
- `CLOUDFLARE_WORKERSAI_ACCOUNT_ID`

Keep them server-only, with no `PUBLIC_` or `VITE_` prefix. Never copy the complete 1Password Environment into Vercel. Use the approved private mount for local evaluations, selecting only these variables in process memory. Do not commit credentials, provider responses containing credentials, or local auth files.

Requests are limited to a 240-character question and a 2 KiB JSON body. Cross-origin requests and unsupported methods are rejected. The model and endpoint are fixed. Each search makes at most two provider requests, with no retries, 12-second upstream timeouts and a conservative 60 KiB input bound. The function allows at most four concurrent searches and six requests per minute per forwarded IP **within each warm instance**. These in-memory guards are not a distributed rate limit or a hard account spending cap. A shared platform firewall rule can be added separately if traffic warrants it.

Responses use `private, no-store`. Application logs contain only a generic provider-failure event, never query text, source passages, credentials, or provider response bodies. The question and candidate passages are sent to Cloudflare for inference; Vercel hosts the endpoint. Browser history retains the query URL. There is no additional search analytics collection.

## Verification

Run `npm test`, `npm run check`, and `npm run build`. Tests cover references and verse overlap, combined filters, literal excerpts, bounded candidate reranking, irrelevant results, provider failures, malformed requests, rate guards, and the real published corpus. DOM checks should cover filter restoration, chapter controls, result pagination, clearing the form, safe excerpt rendering, retry, cached results, and stale-response cancellation.

Deployment checks must call the production endpoint and verify its `mode` is `clef`, not merely that the static homepage loaded. Confirm every result links to a published sermon and the excerpt appears in its source text. A successful static build does not compile the standalone Vercel Function; inspect Vercel's deployment status and logs as well.

Primary references: [Clef](https://developers.cloudflare.com/workers-ai/models/clef/), [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js).
