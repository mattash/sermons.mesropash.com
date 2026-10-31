import test from "node:test";
import assert from "node:assert/strict";
import { orderHits, summaryPreview, scripturePreview } from "../src/lib/archive-presentation.ts";
import { searchUrl, EMPTY_FILTERS } from "../src/lib/search.ts";

test("date sorting happens before pagination and relevance keeps the provider order", () => {
  const hits = [{id:"new"}, {id:"old"}, {id:"middle"}];
  const docs = [
    {id:"new",data:{sermonDate:"2026-01-01"}},
    {id:"old",data:{sermonDate:"2022-01-01"}},
    {id:"middle",data:{sermonDate:"2024-01-01"}}
  ];
  assert.deepEqual(orderHits(hits,docs,"oldest").map(x=>x.id),["old","middle","new"]);
  assert.deepEqual(orderHits(hits,docs,"newest").map(x=>x.id),["new","middle","old"]);
  assert.deepEqual(orderHits(hits,docs,"relevance"),hits);
  assert.equal(hits[0].id,"new");
  const url = new URL(searchUrl(2,"prayer",{...EMPTY_FILTERS,year:"2025"},"oldest"),"https://example.com");
  assert.equal(url.searchParams.get("sort"),"oldest");
  assert.equal(url.searchParams.get("year"),"2025");
  assert.equal(url.searchParams.get("q"),"prayer");
  assert.equal(url.searchParams.get("page"),"2");
});

test("compact previews preserve source wording, abbreviations and Scripture ranges", () => {
  const text = "Reflecting on the Gospel, Fr. Garabed invites us to trust God and follow Christ in daily life. A second sentence.";
  assert.equal(summaryPreview(text), "Reflecting on the Gospel, Fr. Garabed invites us to trust God and follow Christ in daily life.");
  const long = "This is a long sentence about faith and the life of the Church ".repeat(8);
  assert(long.startsWith(summaryPreview(long).replace(/…$/,"")));
  assert.equal(scripturePreview("Luke 1:39-56; 1 Corinthians 6:19-20"),"Luke 1:39–56");
  assert.equal(scripturePreview("1 John 1:1–2:3"),"1 John 1:1–2:3");
  assert.equal(scripturePreview(null),"");
});
