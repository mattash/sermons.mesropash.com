# Sermon topic discovery with Clef

The public archive uses Cloudflare's `@cf/cloudflare/clef` decision model to assign a fixed vocabulary of 27 topics and compare sermons on similar subjects. Results are saved in `src/data/discovery.json`, keyed by immutable archive IDs. The generated sermon Markdown and the private archive's reviewed text remain the source content.

## How it works

1. Read each approved, published transcript in full. Ask an independent ordinal question for each topic: absent, passing mention, substantial, or central. Keep up to four substantial topics, based on the score and the combined probability of the substantial/central outcomes. An uncertain sermon can have no assignment.
2. Shortlist up to eight other sermons using shared canonical topics and transcript TF-IDF similarity. General Christian vocabulary is excluded from the lexical weighting. Exclude self and duplicate source videos.
3. Ask Clef to compare each candidate pair's central teaching and pastoral concern. Save up to four sufficiently related results, ordered by the combined score. A common preacher or feast alone is insufficient. Show shared topic labels as the explanation. Do not force matches to fill a quota.
4. Serve static topic pages and related-sermon links. Browsing those features does not cause model calls. Keep the original generated tags as searchable keywords and preserve their existing URLs. The separate question-search feature is described in [search.md](search.md).

Model responses are checkpointed in the ignored `.cache/clef-responses.json`. Cache keys include the model ID, prompt version, complete state and questions. Definition changes invalidate the corresponding decisions. Changed transcripts cannot retain old assignments or recommendations: build-time fingerprints cover the title, summary, and transcript. Withdrawn sermons, duplicate source videos, and broken target references are filtered from rendered recommendations.

The hosted API exposes a model ID rather than immutable model weights. Use `--force` for a deliberate fresh evaluation after a hosted model change. `TAXONOMY_VERSION` and `DISCOVERY_PROMPT_VERSION` version the application conventions. The public artifact records those versions, the model ID, and its generation time; the local cache preserves probability distributions and evaluation times.

## Local refresh

The 1Password-managed mount is outside the checkout at `/Users/mattash/.config/sermon-archive/clef.env`. The client consumes only `CLOUDFLARE_WORKERSAI_API_KEY` and `CLOUDFLARE_WORKERSAI_ACCOUNT_ID`; it does not source the complete Environment into the process or copy its values into another file.

```bash
npm run sync:sermons
npm run discovery:refresh -- --credential-file "$HOME/.config/sermon-archive/clef.env"
npm test
npm run check
npm run build
```

A small sample uses `--ids 68,74,22,100` and writes `.cache/clef-sample.json`, never the production artifact. `--classify-only` also writes only a sample. `--concurrency` defaults to 3 and is capped at 5; `--max-requests` bounds the run. Failed requests retry within a fixed budget. Valid results are checkpointed so an interrupted run resumes without repeating successful inference. A failed refresh leaves the published artifact intact. Inputs that exceed the conservative context budget fail instead of silently truncating a transcript.

## Curator corrections

Edit `src/data/topic-overrides.json` to override an assignment with stable topic IDs, then refresh. For example, `{"68": ["forgiveness", "repentance"]}` replaces sermon 68's automatic topics. An empty array deliberately removes its assignments. Overrides are validated, preserved across refreshes, and marked `curator` in the artifact. Changing an override also rebuilds candidate relationships; relatedness still requires Clef's judgment.

Edit definitions and aliases in `src/lib/topic-taxonomy.ts` to improve the vocabulary. Keep existing IDs stable. Scripture and feast names remain searchable independently of these topical categories.

## Hourly publishing

The existing GitHub Action syncs finalized sermons and can refresh discovery using repository secrets named `CLOUDFLARE_WORKERSAI_API_KEY` and `CLOUDFLARE_WORKERSAI_ACCOUNT_ID`. Only the Clef refresh step receives them. This build-time discovery does not require credentials in Vercel or the browser; live question search separately needs server-only Vercel credentials. GitHub Actions caches only model responses, which contain public-sermon judgments, never credentials. A new runner may make a first full inference pass; later runs reuse cached decisions.

If credentials are absent, the Action preserves the last discovery artifact. If Cloudflare fails, it still publishes valid sermon content and preserves the last good artifact. Newly added or revised sermons receive recommendations after a successful refresh; withdrawn or stale references disappear immediately at build time. The Action runs tests, type checks, and a static build before committing changes.

## Evaluation and limits

The first pass was reviewed against concrete sermon cases: forgiveness and the Prodigal Son, anxiety and peace, humility, stewardship, and the Transfiguration. A vocabulary gap around Christ's glory was corrected before publication. These checks support an initial release, not a claim of exhaustive theological or bilingual accuracy. Curator overrides provide a durable correction mechanism.

Primary references: [Clef API](https://developers.cloudflare.com/workers-ai/models/clef/), [model card](https://huggingface.co/Cloudflare/clef), and [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).
