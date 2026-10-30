# Topic discovery proposal

Status: proposal, October 30, 2026. No model calls, topic reassignment, or recommendation feature are enabled yet.

## The current problem

The 98 published sermons have 935 distinct topic and Scripture labels; 870 labels appear on just one sermon. Exact matching treats capitalization, punctuation, and differently worded versions of the same idea as different topics. A freely generated keyword is useful search material but a poor browsing category.

Generated Markdown is a publication artifact. Persist canonical topic assignments in the private archive and export them; do not manually retag this repository's sermon files.

## Stable topics

Start with approximately 20–30 topics, each with a stable ID, display label, definition, and aliases. Examples include forgiveness, repentance, humility, prayer, faith and trust, love and mercy, suffering and hope, resurrection, the cross, the Holy Spirit, the Eucharist, stewardship, service, family, and life in the Church. Distinguish their definitions so related categories remain useful.

Keep Scripture passages and liturgical occasions as separate facets. Normalize book names, chapter/verse ranges, and feast-name aliases instead of mixing them into the topical vocabulary. Preserve the old generated labels as search keywords and retain existing topic URLs while introducing canonical ones.

Use Jev or Clef to assess each approved transcript against the fixed definitions. Ask an independent question for each topic: “Is this a central subject that this sermon meaningfully develops, rather than a passing reference?” Use a boolean probability or an ordinal rubric for absent / mentioned / secondary / central. A single mutually exclusive Choice would prevent a sermon from having several themes.

Choose a small number of strong topics, normally 2–4, using thresholds calibrated against reviewed examples. Allow no confident match. Save transcript hash, taxonomy version, model version, prompt version, raw scores, and selected topic IDs. Curator corrections should override model suggestions. Recompute when the transcript or taxonomy changes, rather than generating tags during page requests.

## Similar sermons

Add 3–5 related-sermon links to each sermon page, with shared topic labels explaining the connection. Use the actual sermon text as the basis for comparisons, not just its existing generated tags.

For the current archive, shortlist candidates using topic profiles and transcript keyword relevance. Have the decision model compare the shortlist with the source sermon using separate questions for shared central teaching and shared pastoral concern. A common preacher, generic Christian language, or the same feast alone should not qualify a match. Exclude the sermon itself and duplicate versions of the same sermon.

Compute and cache those links during publication. Persist results outside the generated Markdown and key them by immutable archive IDs and content/model/taxonomy versions. Validate referenced IDs against the published collection so withdrawn sermons cannot leave broken links. Serving the recommendations then needs no model request or public API key. Preserve the last valid output if the model is unavailable; do not silently present keyword matches as model-judged recommendations.

Embeddings can improve the candidate shortlist if evaluation shows missed connections. A vector database is unnecessary for 98 sermons. Introduce query-time model ranking separately if natural-language search later becomes a requirement.

## Choosing a model

Compare Jev and Clef-flash on the same small set of sermons and candidate pairs before choosing. Review approximately 20 seed sermons, covering overlapping themes, different feasts, Armenian-specific theology, and bilingual text. Judge whether each of the first three suggestions is useful, and inspect false matches and omitted topics. Tune thresholds on one set and check them on held-out examples. General vendor benchmarks do not establish quality for this archive.

Relevant primary documentation:

- [TypeSafe structured decisions](https://docs.typesafe.ai/introduction)
- [TypeSafe reranking pattern](https://docs.typesafe.ai/cookbooks/rerank_typesafe)
- [Cloudflare Clef model](https://huggingface.co/Cloudflare/clef)
- [Cloudflare Clef family update](https://blog.cloudflare.com/clef-faster-cheaper-multimodal/)
