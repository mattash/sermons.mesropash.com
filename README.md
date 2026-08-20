# sermons.mesropash.com

The public, static sermon archive for Fr. Mesrop Ash.

## Publishing workflow

1. The private sermon archive is the source of truth. Only records with both `status=reviewed` and `review_status=reviewed` are published by its public API.
2. This repository's GitHub Action runs hourly (and can be run manually), fetches that API, and converts every finalized sermon to `src/content/sermons/*.md`.
3. Changed Markdown is committed automatically. Vercel deploys that commit to `https://sermons.mesropash.com`.

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

