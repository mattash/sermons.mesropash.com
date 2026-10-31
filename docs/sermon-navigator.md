# At a glance

The sermon detail page displays three to six short sentences in reading order. Each sentence links to a source passage. The menu stays visible on the right at desktop widths; below 1024px it becomes a collapsed disclosure above the sermon. Without JavaScript the disclosure remains open and ordinary fragment links still work. Selecting a point updates the URL, highlights its passage, and moves keyboard focus to the destination. The current point follows reading progress.

## Generation and verification

`npm run navigators:refresh` reads the published Markdown without changing it. Cloudflare's `@cf/meta/llama-3.3-70b-instruct-fp8-fast` drafts the sentences, and `@cf/cloudflare/clef` checks each for direct support from its cited passage and importance within the sermon. Failed points are omitted only if at least three verified points remain; otherwise the generator attempts a repaired outline. Armenian text is summarized in English, and bilingual content is not intentionally duplicated.

The generator uses only `CLOUDFLARE_WORKERSAI_API_KEY` and `CLOUDFLARE_WORKERSAI_ACCOUNT_ID`. Supply them through the process environment or a private dotenv file:

```sh
npm run navigators:refresh -- --credential-file /path/to/private.env
npm run navigators:refresh -- --ids 53,68,124 --credential-file /path/to/private.env
```

A sample run writes `.cache/navigator-sample.json` and cannot replace the public artifact. The full run writes `src/data/navigators.json` atomically only after all sermons have verified outlines. Responses and verified progress are cached under `.cache/` so interrupted runs can resume. Default concurrency is three, with a maximum of 600 model requests per run; `--concurrency`, `--max-requests`, and `--force` control these limits and cache reuse. Provider retries are bounded separately.

The hourly GitHub publishing workflow uses the existing two Cloudflare repository secrets and runs with `--if-credentials`. Missing credentials skip generation. A generation failure preserves the last published artifact while allowing sermon publication to continue. Content hashes include the transcript, title, theme, renderer passage version, prompt version, and model names; outdated or invalid outlines are hidden until regenerated. Thus a newly published or changed sermon can temporarily lack a menu if generation fails.

## Source anchors

`src/lib/sermon-passages.ts` renders Markdown with Astro's Satteri processor and adds stable spans around paragraphs or sentence groups of about 900 characters. Inline formatting, links, entities, and text are preserved, including sermons stored in a single long paragraph. Passage IDs derive from their exact rendered text, with a duplicate suffix when needed. No generated source Markdown or private archive records are edited.

`src/lib/sermon-navigator.ts` validates the sentence count, length, distinct destinations, source order, artifact versions, and content hash before the page displays a menu. `tests/sermon-navigator.test.mjs` covers text preservation, stable anchors, invalid outlines, stale records, and the verification gate.

Before publishing, run `npm test`, `npm run check`, and `npm run build`, then verify desktop and mobile passage links in the browser.
