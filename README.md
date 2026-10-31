# sermons.mesropash.com

The public sermon archive for Fr. Mesrop Ash: static pages with one server-side search endpoint.

## Publishing workflow

1. The private sermon archive is the source of truth. Only records with both `status=reviewed` and `review_status=reviewed` are published by its public API.
2. This repository's GitHub Action runs hourly (and can be run manually), fetches that API, converts every finalized sermon to `src/content/sermons/*.md`, and refreshes Clef discovery when its credentials are configured.
3. Changed Markdown and discovery data are committed automatically. Vercel deploys that commit to `https://sermons.mesropash.com`.

The Markdown is generated. Edit sermon content in the archive, not in this repository.

## Local development

```bash
npm install
npm run dev
```

To refresh the local Markdown from the public archive endpoint:

```bash
npm run sync:sermons
npm run check
npm run build
```

Use `SERMON_ARCHIVE_API_URL` to point a local sync at another compatible API endpoint.

## Archive browsing

The homepage and `/page/2/`, `/page/3/`, etc. are static pages with 12 sermons each, newest first. Every sermon remains reachable without JavaScript. The homepage links to six starting topics and the complete topic index. Compact sermon rows use the recorded date, preacher, a Scripture preview, and up to two canonical topic links. Newest/oldest sorting works across the archive and preserves filters and pagination; query searches default to relevance.

Search loads published transcripts from `/search.json` on demand. It ranks transcript matches locally, and submitting a question calls `/api/search` to find related ideas with Clef. Results show excerpts from the source text. Scripture book/chapter, feast or season, year, preacher, and topic filters work together, with or without a question. Search URLs preserve the query, filters, and page, for example `/?book=matthew&chapter=5&year=2025`.

The live Clef endpoint needs the two Cloudflare variables in the Vercel **production runtime**. Without them, transcript search and all filters still work. `astro dev` and `astro preview` serve the static site; the root `api/search.ts` function runs on Vercel. See [docs/search.md](docs/search.md) for architecture, deployment, evaluation, and limits.

Run `npm test`, `npm run check`, and `npm run build` before publishing changes. Clef assigns a stable topic vocabulary and compares full transcripts to produce cached related-sermon links. Browse them at `/topics/`. Setup, refresh commands, curator overrides, and the hourly publishing behavior are documented in [docs/topic-discovery.md](docs/topic-discovery.md).

